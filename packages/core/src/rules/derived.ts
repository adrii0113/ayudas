import type { HouseholdProfile, ProfileField } from "../profile";
import type { DerivedField, RuleField } from "./types";
import { DERIVED_FIELDS } from "./types";

/** Minimum disability percentage that counts as legally recognised disability. */
export const DISABILITY_THRESHOLD = 33;

/**
 * Resolved field value:
 * - `undefined`: the user did not answer → the rule is `unknown`.
 * - `null`: answered but not applicable (e.g. youngest child age with no children).
 */
export type FieldValue = string | number | boolean | null | undefined;

/** Profile fields each derived value is computed from (used by the questionnaire). */
export const DERIVED_FIELD_DEPENDENCIES: Record<DerivedField, ProfileField[]> = {
  numChildren: ["children"],
  numMinors: ["children"],
  youngestChildAge: ["children"],
  oldestChildAge: ["children"],
  numChildrenWithDisability: ["children"],
  numAdults: ["householdSize", "children"],
  extraAdults: ["householdSize", "children"],
  incomePerCapita: ["annualHouseholdIncome", "householdSize"],
};

export function isDerivedField(field: string): field is DerivedField {
  return (DERIVED_FIELDS as readonly string[]).includes(field);
}

function computeDerived(profile: HouseholdProfile, field: DerivedField): FieldValue {
  const { children, householdSize, annualHouseholdIncome } = profile;
  switch (field) {
    case "numChildren":
      return children?.length;
    case "numMinors":
      return children?.filter((c) => c.age < 18).length;
    case "youngestChildAge":
      if (!children) return undefined;
      return children.length ? Math.min(...children.map((c) => c.age)) : null;
    case "oldestChildAge":
      if (!children) return undefined;
      return children.length ? Math.max(...children.map((c) => c.age)) : null;
    case "numChildrenWithDisability":
      if (!children) return undefined;
      // A child whose disability was not answered makes the count uncertain.
      if (children.some((c) => c.disabilityPercent === undefined)) {
        const known = children.filter((c) => (c.disabilityPercent ?? 0) >= DISABILITY_THRESHOLD);
        return known.length > 0 ? known.length : undefined;
      }
      return children.filter((c) => (c.disabilityPercent ?? 0) >= DISABILITY_THRESHOLD).length;
    case "numAdults": {
      if (householdSize === undefined || children === undefined) return undefined;
      const minors = children.filter((c) => c.age < 18).length;
      return Math.max(1, householdSize - minors);
    }
    case "extraAdults": {
      const adults = computeDerived(profile, "numAdults");
      return typeof adults === "number" ? adults - 1 : adults;
    }
    case "incomePerCapita":
      if (annualHouseholdIncome === undefined || householdSize === undefined) return undefined;
      return annualHouseholdIncome / householdSize;
  }
}

export function resolveField(profile: HouseholdProfile, field: RuleField): FieldValue {
  if (isDerivedField(field)) return computeDerived(profile, field);
  const value = profile[field];
  if (Array.isArray(value)) return value.length;
  return value as FieldValue;
}
