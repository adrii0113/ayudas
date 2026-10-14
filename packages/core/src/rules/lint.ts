import { EMPLOYMENT_STATUSES, HOUSING_SITUATIONS } from "../profile";
import type { RuleField, RuleGroup, RuleNode, RuleValue } from "./types";
import { isRuleGroup } from "./types";

type FieldKind = "number" | "boolean" | "string" | { enum: readonly string[] };

/** Value type of each rule field, used to catch catalog mistakes statically. */
export const FIELD_KINDS: Record<RuleField, FieldKind> = {
  region: "string",
  municipality: "string",
  applicantAge: "number",
  householdSize: "number",
  children: "number", // compared as the number of children
  annualHouseholdIncome: "number",
  employmentStatus: { enum: EMPLOYMENT_STATUSES },
  housing: { enum: HOUSING_SITUATIONS },
  monthlyRent: "number",
  isLargeFamily: "boolean",
  isSingleParent: "boolean",
  hasDependentPerson: "boolean",
  applicantDisabilityPercent: "number",
  yearsRegisteredInRegion: "number",
  yearsLegalResidenceInSpain: "number",
  receivesMinimumIncome: "boolean",
  numChildren: "number",
  numMinors: "number",
  youngestChildAge: "number",
  oldestChildAge: "number",
  numChildrenWithDisability: "number",
  numAdults: "number",
  extraAdults: "number",
  incomePerCapita: "number",
};

function checkScalar(kind: FieldKind, value: unknown): string | null {
  if (kind === "number") {
    return typeof value === "number" || (typeof value === "object" && value !== null)
      ? null
      : "expected a number or value expression";
  }
  if (kind === "boolean") return typeof value === "boolean" ? null : "expected a boolean";
  if (kind === "string") return typeof value === "string" ? null : "expected a string";
  return typeof value === "string" && kind.enum.includes(value)
    ? null
    : `expected one of ${kind.enum.join(", ")}`;
}

function checkValue(field: RuleField, op: string, value: RuleValue): string | null {
  const kind = FIELD_KINDS[field];
  if (op === "in") {
    if (!Array.isArray(value)) return "`in` needs an array";
    for (const v of value) {
      const err = checkScalar(kind, v);
      if (err) return err;
    }
    return null;
  }
  if (["lt", "lte", "gt", "gte"].includes(op) && kind !== "number") {
    return `\`${op}\` only applies to numeric fields`;
  }
  return checkScalar(kind, value);
}

/** Returns human-readable problems in a rule tree (empty array = OK). */
export function lintRules(group: RuleGroup, path = "eligibility"): string[] {
  const errors: string[] = [];
  const visit = (node: RuleNode, at: string) => {
    if (isRuleGroup(node)) {
      if (!node.all && !node.any) errors.push(`${at}: group needs \`all\` or \`any\``);
      node.all?.forEach((c, i) => visit(c, `${at}.all[${i}]`));
      node.any?.forEach((c, i) => visit(c, `${at}.any[${i}]`));
      return;
    }
    if (node.op === "exists") return;
    const err = checkValue(node.field, node.op, node.value);
    if (err) errors.push(`${at} (${node.field} ${node.op}): ${err}`);
  };
  visit(group, path);
  return errors;
}
