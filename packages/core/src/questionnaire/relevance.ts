import type { Benefit } from "../benefit";
import { CONSTANT_KEYS } from "../config/types";
import { effectiveRules } from "../matching";
import type { HouseholdProfile, ProfileField } from "../profile";
import { DERIVED_FIELD_DEPENDENCIES, isDerivedField } from "../rules/derived";
import type { RuleField, RuleNode, ValueExpr } from "../rules/types";
import { isRuleGroup } from "../rules/types";
import { QUESTIONS, type Question } from "./questions";

function addField(field: string, out: Set<ProfileField>) {
  if (isDerivedField(field)) {
    for (const dep of DERIVED_FIELD_DEPENDENCIES[field]) out.add(dep);
  } else {
    out.add(field as ProfileField);
  }
}

function collectExpr(expr: unknown, out: Set<ProfileField>) {
  if (typeof expr !== "object" || expr === null || Array.isArray(expr)) return;
  const e = expr as Exclude<ValueExpr, number>;
  if ("ref" in e) {
    if (!(CONSTANT_KEYS as readonly string[]).includes(e.ref)) addField(e.ref, out);
  } else ("add" in e ? e.add : e.mul).forEach((x) => collectExpr(x, out));
}

function collectNode(node: RuleNode, out: Set<ProfileField>) {
  if (isRuleGroup(node)) {
    [...(node.all ?? []), ...(node.any ?? [])].forEach((c) => collectNode(c, out));
    return;
  }
  addField(node.field as RuleField, out);
  if (node.op !== "exists") collectExpr(node.value, out);
}

/** Profile fields referenced by the eligibility rules of the given benefits. */
export function relevantFields(benefits: Benefit[]): Set<ProfileField> {
  const out = new Set<ProfileField>();
  for (const b of benefits) collectNode(effectiveRules(b), out);
  return out;
}

/**
 * Questions to ask, in order, given the active catalog and current answers.
 * A question is skipped if no active benefit uses its fields.
 */
export function selectQuestions(
  benefits: Benefit[],
  answers: Partial<HouseholdProfile>,
  questions: Question[] = QUESTIONS,
): Question[] {
  const fields = relevantFields(benefits);
  return questions.filter(
    (q) =>
      (q.always || q.fields.some((f) => fields.has(f))) && (q.showIf ? q.showIf(answers) : true),
  );
}
