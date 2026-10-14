import type { Benefit } from "./benefit";
import { getConstantsInForce } from "./config";
import type { OfficialConstants } from "./config/types";
import type { HouseholdProfile } from "./profile";
import { getRegion } from "./regions";
import { evaluateRules } from "./rules/evaluate";
import type { EligibilityResult, RuleGroup, RuleNode } from "./rules/types";
import { getWindowStatus, todayInSpain, type WindowStatus } from "./window";

export type MatchOptions = {
  /** YYYY-MM-DD. Defaults to today in Spain. */
  today?: string;
  constants?: OfficialConstants;
  almostMaxFailed?: number;
  /** Include calls whose deadline has passed (admin preview). */
  includeClosed?: boolean;
};

export type BenefitMatch = EligibilityResult & {
  benefit: Benefit;
  window: WindowStatus;
};

/** Rules implied by where a benefit applies; failing them is never "almost". */
export function scopeRules(benefit: Benefit): RuleNode[] {
  const rules: RuleNode[] = [];
  if (benefit.level !== "state" && benefit.region) {
    const name = getRegion(benefit.region)?.name ?? benefit.region;
    rules.push({
      field: "region",
      op: "eq",
      value: benefit.region,
      label: `Vivir en ${name}`,
      hard: true,
    });
  }
  if (benefit.level === "municipal" && benefit.municipality) {
    const name =
      getRegion(benefit.region ?? "")?.municipalities.find(
        (m) => m.ineCode === benefit.municipality,
      )?.name ?? benefit.municipality;
    rules.push({
      field: "municipality",
      op: "eq",
      value: benefit.municipality,
      label: `Estar empadronado en ${name}`,
      hard: true,
    });
  }
  return rules;
}

export function effectiveRules(benefit: Benefit): RuleGroup {
  const scope = scopeRules(benefit);
  if (scope.length === 0) return benefit.eligibility;
  return { all: [...scope, benefit.eligibility] };
}

const STATUS_ORDER = { eligible: 0, almost: 1, unknown: 2, not_eligible: 3 } as const;

/**
 * Pure matching function: profile + benefits → one result per benefit.
 * Independent of any framework so it can be exposed later as an API/widget.
 */
export function evaluate(
  profile: HouseholdProfile,
  benefits: Benefit[],
  options: MatchOptions = {},
): BenefitMatch[] {
  const today = options.today ?? todayInSpain();
  const constants = options.constants ?? getConstantsInForce(Number(today.slice(0, 4)));
  const results: BenefitMatch[] = [];
  for (const benefit of benefits) {
    const window = getWindowStatus(benefit, today);
    if (window === "closed" && !options.includeClosed) continue;
    const result = evaluateRules(effectiveRules(benefit), profile, {
      constants,
      almostMaxFailed: options.almostMaxFailed,
    });
    results.push({ ...result, benefit, window });
  }
  return results.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.benefit.title.localeCompare(b.benefit.title, "es"),
  );
}
