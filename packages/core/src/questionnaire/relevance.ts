import type { Benefit } from "../benefit";
import { CONSTANT_KEYS } from "../config/types";
import { effectiveRules, evaluate, type MatchOptions } from "../matching";
import type { HouseholdProfile, ProfileField } from "../profile";
import { DERIVED_FIELD_DEPENDENCIES, isDerivedField } from "../rules/derived";
import type { RuleField, RuleNode, ValueExpr } from "../rules/types";
import { compositeParts, isRuleGroup } from "../rules/types";
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
  } else compositeParts(e)[1].forEach((x) => collectExpr(x, out));
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

/** Possible answers of a question, when they can be enumerated. */
function enumerateAnswers(q: Question): Partial<HouseholdProfile>[] | undefined {
  if (q.input.type === "choice") return q.input.options.map((o) => o.set);
  if (q.input.type === "yesNo") return [{ [q.input.field]: true }, { [q.input.field]: false }];
  return undefined;
}

/**
 * True if every possible answer to `q` yields exactly the same results given
 * the current answers, so asking it would not change anything for the user.
 */
function answerChangesNothing(
  q: Question,
  benefits: Benefit[],
  answers: Partial<HouseholdProfile>,
  options: MatchOptions,
): boolean {
  const candidates = enumerateAnswers(q);
  if (!candidates || !answers.region) return false;
  const signature = (patch: Partial<HouseholdProfile>) =>
    evaluate({ ...answers, ...patch, region: answers.region! }, benefits, options)
      .map((m) => `${m.benefit.id}:${m.status}:${m.failed.length}:${m.unknown.length}`)
      .join("|");
  const first = signature(candidates[0]!);
  return candidates.every((c) => signature(c) === first);
}

export type SelectQuestionsOptions = MatchOptions & {
  /** Skip enumerable questions whose answer cannot change any result. Default true. */
  skipIrrelevant?: boolean;
};

/**
 * Questions to ask, in order, given the active catalog and current answers.
 * A question is skipped if no active benefit uses its fields, or if (for
 * choice/yes-no questions not answered yet) no possible answer changes the
 * results.
 */
export function selectQuestions(
  benefits: Benefit[],
  answers: Partial<HouseholdProfile>,
  questions: Question[] = QUESTIONS,
  options: SelectQuestionsOptions = {},
): Question[] {
  const fields = relevantFields(benefits);
  const { skipIrrelevant = true, ...matchOptions } = options;
  return questions.filter((q) => {
    if (!(q.always || q.fields.some((f) => fields.has(f)))) return false;
    if (q.showIf && !q.showIf(answers)) return false;
    if (q.always || !skipIrrelevant) return true;
    const answered = q.fields.every((f) => answers[f] !== undefined);
    return answered || !answerChangesNothing(q, benefits, answers, matchOptions);
  });
}

/**
 * Completes the answers once the questionnaire ends: follow-up questions that
 * were skipped because of previous answers get their implied value (or are
 * cleared, so stale answers never leak into the evaluation).
 */
export function finalizeAnswers(
  answers: Partial<HouseholdProfile>,
  questions: Question[] = QUESTIONS,
): Partial<HouseholdProfile> {
  const result: Partial<HouseholdProfile> = { ...answers };
  for (const q of questions) {
    if (!q.showIf || q.showIf(result)) continue;
    if (q.whenHidden) Object.assign(result, q.whenHidden);
  }
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) delete result[key as keyof HouseholdProfile];
  }
  return result;
}
