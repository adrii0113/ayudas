import type { ConstantKey } from "../config/types";
import type { ProfileField } from "../profile";

/** Values computed in code from the profile (never by the LLM). */
export const DERIVED_FIELDS = [
  "numChildren",
  "numMinors",
  "youngestChildAge",
  "oldestChildAge",
  "numChildrenWithDisability",
  "numAdults",
  "extraAdults",
  "incomePerCapita",
] as const;
export type DerivedField = (typeof DERIVED_FIELDS)[number];

export type RuleField = ProfileField | DerivedField;

export const COMPARISON_OPS = ["eq", "neq", "lt", "lte", "gt", "gte", "in"] as const;
export type ComparisonOp = (typeof COMPARISON_OPS)[number];

/**
 * Value side of a comparison. Literals, or a small arithmetic expression over
 * official constants and profile/derived fields, e.g. "1.5 × IPREM + 0.5 × IPREM
 * per minor":
 *
 *   { mul: [{ ref: "iprem14" }, { add: [1.5, { mul: [0.5, { ref: "numMinors" }] }] }] }
 */
export type ValueExpr =
  | number
  | { ref: ConstantKey | RuleField }
  | { add: ValueExpr[] }
  | { mul: ValueExpr[] }
  | { min: ValueExpr[] };

export type RuleValue = string | number | boolean | (string | number)[] | ValueExpr;

/** Where a requirement comes from: a literal fragment of the official text. */
export type RuleSource = { url?: string; excerpt: string };

export type ComparisonRule = {
  field: RuleField;
  op: ComparisonOp;
  value: RuleValue;
  /** Human-readable requirement, in plain Spanish. */
  label: string;
  /** If true, failing it can never produce `almost` (e.g. wrong region). */
  hard?: boolean;
  source?: RuleSource;
};

export type ExistsRule = {
  op: "exists";
  field: RuleField;
  label: string;
  hard?: boolean;
  source?: RuleSource;
};

export type Rule = ComparisonRule | ExistsRule;

export type RuleGroup = {
  all?: RuleNode[];
  any?: RuleNode[];
  /** Label used when the group is reported as a single requirement (`any`). */
  label?: string;
  hard?: boolean;
};

export type RuleNode = Rule | RuleGroup;

export type Tri = "pass" | "fail" | "unknown";

export type EligibilityStatus = "eligible" | "almost" | "not_eligible" | "unknown";

/** A requirement as reported to the user. */
export type RequirementResult = {
  label: string;
  hard: boolean;
  source?: RuleSource;
};

export type EligibilityResult = {
  status: EligibilityStatus;
  met: RequirementResult[];
  failed: RequirementResult[];
  unknown: RequirementResult[];
};

export type CompositeExpr = Exclude<ValueExpr, number | { ref: unknown }>;

/** Operator and operands of a composite value expression. */
export function compositeParts(expr: CompositeExpr): ["add" | "mul" | "min", ValueExpr[]] {
  if ("add" in expr) return ["add", expr.add];
  if ("mul" in expr) return ["mul", expr.mul];
  return ["min", expr.min];
}

export function isRuleGroup(node: RuleNode): node is RuleGroup {
  return !("op" in node);
}
