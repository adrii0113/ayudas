import type { OfficialConstants } from "../config/types";
import { CONSTANT_KEYS, type ConstantKey } from "../config/types";
import type { HouseholdProfile } from "../profile";
import { resolveField, type FieldValue } from "./derived";
import type {
  EligibilityResult,
  RequirementResult,
  Rule,
  RuleField,
  RuleGroup,
  RuleNode,
  RuleValue,
  Tri,
  ValueExpr,
} from "./types";
import { compositeParts, isRuleGroup } from "./types";

export type EvaluateOptions = {
  constants: OfficialConstants;
  /** Max number of failed (non-hard) requirements still reported as `almost`. */
  almostMaxFailed?: number;
};

type Context = { profile: HouseholdProfile; constants: OfficialConstants };

/** A requirement unit: a leaf rule, or an `any` group reported as one requirement. */
type Unit = RequirementResult & { tri: Tri };

type NodeOutcome = { tri: Tri; units: Unit[] };

function isConstantKey(ref: string): ref is ConstantKey {
  return (CONSTANT_KEYS as readonly string[]).includes(ref);
}

/** Evaluates a value expression. Returns `undefined` if any input is unknown. */
export function evaluateValueExpr(expr: ValueExpr, ctx: Context): number | undefined {
  if (typeof expr === "number") return expr;
  if ("ref" in expr) {
    if (isConstantKey(expr.ref)) return ctx.constants[expr.ref];
    const value = resolveField(ctx.profile, expr.ref as RuleField);
    return typeof value === "number" ? value : undefined;
  }
  const [op, args] = compositeParts(expr);
  const parts = args.map((e) => evaluateValueExpr(e, ctx));
  if (parts.some((p) => p === undefined)) return undefined;
  const nums = parts as number[];
  if (op === "add") return nums.reduce((a, b) => a + b, 0);
  if (op === "mul") return nums.reduce((a, b) => a * b, 1);
  return Math.min(...nums);
}

function isValueExpr(value: RuleValue): value is ValueExpr {
  return (
    typeof value === "number" ||
    (typeof value === "object" && !Array.isArray(value) && value !== null)
  );
}

/** Resolves the expected value of a comparison. `undefined` means unknown. */
function resolveExpected(value: RuleValue, ctx: Context): RuleValue | undefined {
  return isValueExpr(value) ? evaluateValueExpr(value, ctx) : value;
}

function compare(actual: FieldValue, rule: Rule, ctx: Context): Tri {
  if (actual === undefined) return "unknown";

  if (rule.op === "exists") return actual === null ? "fail" : "pass";

  if (actual === null) return rule.op === "neq" ? "pass" : "fail";

  const expected = resolveExpected(rule.value, ctx);
  if (expected === undefined) return "unknown";

  switch (rule.op) {
    case "eq":
      return actual === expected ? "pass" : "fail";
    case "neq":
      return actual !== expected ? "pass" : "fail";
    case "in":
      if (!Array.isArray(expected)) return "unknown";
      return (expected as (string | number | boolean)[]).includes(actual) ? "pass" : "fail";
    default: {
      // Ordering comparisons only make sense between numbers; a type mismatch is
      // a catalog error (caught by lintRules) and is reported as unknown.
      if (typeof actual !== "number" || typeof expected !== "number") return "unknown";
      const ok =
        rule.op === "lt"
          ? actual < expected
          : rule.op === "lte"
            ? actual <= expected
            : rule.op === "gt"
              ? actual > expected
              : actual >= expected;
      return ok ? "pass" : "fail";
    }
  }
}

function toRequirement(node: { label: string; hard?: boolean; source?: Rule["source"] }) {
  const req: RequirementResult = { label: node.label, hard: node.hard ?? false };
  if (node.source) req.source = node.source;
  return req;
}

function combineAll(outcomes: Tri[]): Tri {
  if (outcomes.includes("fail")) return "fail";
  if (outcomes.includes("unknown")) return "unknown";
  return "pass";
}

function combineAny(outcomes: Tri[]): Tri {
  if (outcomes.includes("pass")) return "pass";
  if (outcomes.includes("unknown")) return "unknown";
  return "fail";
}

function leafLabels(node: RuleNode): string[] {
  if (!isRuleGroup(node)) return [node.label];
  if (node.label) return [node.label];
  return [...(node.all ?? []), ...(node.any ?? [])].flatMap(leafLabels);
}

function evaluateNode(node: RuleNode, ctx: Context): NodeOutcome {
  if (!isRuleGroup(node)) {
    const tri = compare(resolveField(ctx.profile, node.field), node, ctx);
    return { tri, units: [{ ...toRequirement(node), tri }] };
  }
  return evaluateGroup(node, ctx);
}

function evaluateAnyGroup(group: RuleGroup, children: RuleNode[], ctx: Context): NodeOutcome {
  const outcomes = children.map((c) => evaluateNode(c, ctx));
  const tri = combineAny(outcomes.map((o) => o.tri));
  const passing = outcomes.findIndex((o) => o.tri === "pass");
  const label =
    tri === "pass" && !group.label
      ? leafLabels(children[passing]!).join(" y ")
      : (group.label ?? children.flatMap(leafLabels).join(" o "));
  return { tri, units: [{ ...toRequirement({ label, hard: group.hard }), tri }] };
}

function evaluateGroup(group: RuleGroup, ctx: Context): NodeOutcome {
  const parts: NodeOutcome[] = [];
  for (const child of group.all ?? []) {
    const outcome = evaluateNode(child, ctx);
    // A hard `all` group propagates hardness to its requirements.
    parts.push(
      group.hard
        ? { ...outcome, units: outcome.units.map((u) => ({ ...u, hard: true })) }
        : outcome,
    );
  }
  if (group.any) parts.push(evaluateAnyGroup(group, group.any, ctx));
  return { tri: combineAll(parts.map((p) => p.tri)), units: parts.flatMap((p) => p.units) };
}

/**
 * Evaluates an eligibility rule tree against a profile using three-valued logic.
 * Missing profile data yields `unknown`; it is never assumed.
 */
export function evaluateRules(
  rules: RuleGroup,
  profile: HouseholdProfile,
  options: EvaluateOptions,
): EligibilityResult {
  const ctx: Context = { profile, constants: options.constants };
  const { tri, units } = evaluateGroup(rules, ctx);
  const strip = ({ tri: _tri, ...req }: Unit): RequirementResult => req;
  const met = units.filter((u) => u.tri === "pass").map(strip);
  const failed = units.filter((u) => u.tri === "fail").map(strip);
  const unknown = units.filter((u) => u.tri === "unknown").map(strip);

  let status: EligibilityResult["status"];
  if (tri === "pass") status = "eligible";
  else if (tri === "unknown") status = "unknown";
  else {
    const maxFailed = options.almostMaxFailed ?? 1;
    const almost = failed.length <= maxFailed && failed.every((f) => !f.hard);
    status = almost ? "almost" : "not_eligible";
  }
  return { status, met, failed, unknown };
}
