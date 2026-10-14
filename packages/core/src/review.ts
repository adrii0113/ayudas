import { needsHumanReview, type Benefit } from "./benefit";
import type { HouseholdProfile } from "./profile";
import { getWindowStatus } from "./window";

export type ReviewWarning = "deadline_passed" | "stale_review" | "pending_human_review";

/** Months after which a published benefit must be reviewed again. */
export const REVIEW_MAX_AGE_MONTHS = 12;

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${toIso.slice(0, 10)}T00:00:00Z`);
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) -
    (b.getUTCDate() < a.getUTCDate() ? 1 : 0)
  );
}

/** Warnings shown in the admin panel for a benefit. */
export function reviewWarnings(benefit: Benefit, today: string): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];
  if (benefit.status === "published" && getWindowStatus(benefit, today) === "closed") {
    warnings.push("deadline_passed");
  }
  if (
    benefit.status === "published" &&
    (!benefit.reviewedAt || monthsBetween(benefit.reviewedAt, today) >= REVIEW_MAX_AGE_MONTHS)
  ) {
    warnings.push("stale_review");
  }
  if (benefit.status === "published" && needsHumanReview(benefit))
    warnings.push("pending_human_review");
  return warnings;
}

/** Example households used by the admin "test with profile" panel. */
export const SAMPLE_PROFILES: { id: string; label: string; profile: HouseholdProfile }[] = [
  {
    id: "single-parent-baby",
    label: "Madre sola con un bebé, 9.000 €/año, alquiler (Valladolid)",
    profile: {
      region: "CL",
      municipality: "47186",
      applicantAge: 29,
      householdSize: 2,
      children: [{ age: 0, disabilityPercent: 0 }],
      isSingleParent: true,
      isLargeFamily: false,
      annualHouseholdIncome: 9000,
      employmentStatus: "employed",
      housing: "renting",
      monthlyRent: 500,
      hasDependentPerson: false,
      applicantDisabilityPercent: 0,
      yearsRegisteredInRegion: 5,
      yearsLegalResidenceInSpain: 5,
      receivesMinimumIncome: false,
    },
  },
  {
    id: "large-family",
    label: "Pareja con 3 hijos (uno con discapacidad), 42.000 €/año, hipoteca",
    profile: {
      region: "CL",
      municipality: "other",
      applicantAge: 41,
      householdSize: 5,
      children: [
        { age: 2, disabilityPercent: 0 },
        { age: 6, disabilityPercent: 0 },
        { age: 10, disabilityPercent: 40 },
      ],
      isSingleParent: false,
      isLargeFamily: true,
      annualHouseholdIncome: 42000,
      employmentStatus: "employed",
      housing: "owner_mortgage",
      hasDependentPerson: false,
      applicantDisabilityPercent: 0,
      yearsRegisteredInRegion: 5,
      yearsLegalResidenceInSpain: 5,
      receivesMinimumIncome: false,
    },
  },
  {
    id: "young-renter",
    label: "Joven de 26 años, vive solo de alquiler, 15.000 €/año",
    profile: {
      region: "CL",
      municipality: "other",
      applicantAge: 26,
      householdSize: 1,
      children: [],
      isSingleParent: false,
      isLargeFamily: false,
      annualHouseholdIncome: 15000,
      employmentStatus: "employed",
      housing: "renting",
      monthlyRent: 450,
      hasDependentPerson: false,
      applicantDisabilityPercent: 0,
      yearsRegisteredInRegion: 5,
      yearsLegalResidenceInSpain: 5,
      receivesMinimumIncome: false,
    },
  },
  {
    id: "unemployed-no-income",
    label: "Persona de 35 años en paro, sin ingresos, vive sola",
    profile: {
      region: "CL",
      municipality: "other",
      applicantAge: 35,
      householdSize: 1,
      children: [],
      isSingleParent: false,
      isLargeFamily: false,
      annualHouseholdIncome: 0,
      employmentStatus: "unemployed",
      housing: "other",
      hasDependentPerson: false,
      applicantDisabilityPercent: 0,
      yearsRegisteredInRegion: 2,
      yearsLegalResidenceInSpain: 5,
      receivesMinimumIncome: false,
    },
  },
  {
    id: "carer-outside",
    label: "Fuera de Castilla y León, cuida de un familiar dependiente",
    profile: {
      region: "OTHER",
      applicantAge: 55,
      householdSize: 2,
      children: [],
      isSingleParent: false,
      isLargeFamily: false,
      annualHouseholdIncome: 20000,
      employmentStatus: "employed",
      housing: "owner_no_mortgage",
      hasDependentPerson: true,
      applicantDisabilityPercent: 0,
      yearsRegisteredInRegion: 0,
      yearsLegalResidenceInSpain: 5,
      receivesMinimumIncome: false,
    },
  },
];
