import { z } from "zod";

export const EMPLOYMENT_STATUSES = [
  "employed",
  "unemployed",
  "self_employed",
  "student",
  "retired",
  "other",
] as const;

export const HOUSING_SITUATIONS = [
  "renting",
  "owner_mortgage",
  "owner_no_mortgage",
  "other",
] as const;

export const childSchema = z.object({
  age: z.number().int().min(0).max(30),
  disabilityPercent: z.number().min(0).max(100).optional(),
});

/**
 * Household profile filled in by the questionnaire. It lives in the browser and
 * is never persisted on the server, except (encrypted) for alert subscribers.
 *
 * Every field except `region` is optional: a missing field means "not answered"
 * and makes any rule depending on it evaluate to `unknown`, never to a guess.
 */
export const householdProfileSchema = z.object({
  region: z.string().min(2),
  /** INE municipality code, e.g. "47186" for Valladolid. */
  municipality: z.string().optional(),
  applicantAge: z.number().int().min(14).max(120).optional(),
  householdSize: z.number().int().min(1).max(20).optional(),
  children: z.array(childSchema).max(15).optional(),
  /** Approximate yearly net income of the whole household, in euros. */
  annualHouseholdIncome: z.number().min(0).optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  housing: z.enum(HOUSING_SITUATIONS).optional(),
  monthlyRent: z.number().min(0).optional(),
  isLargeFamily: z.boolean().optional(),
  isSingleParent: z.boolean().optional(),
  hasDependentPerson: z.boolean().optional(),
  applicantDisabilityPercent: z.number().min(0).max(100).optional(),
  /** Years registered (empadronado) in the region. */
  yearsRegisteredInRegion: z.number().min(0).max(120).optional(),
  /** Years of legal residence in Spain (IMV and others require a minimum). */
  yearsLegalResidenceInSpain: z.number().min(0).max(120).optional(),
  /** Whether someone in the household already receives the Ingreso Mínimo Vital. */
  receivesMinimumIncome: z.boolean().optional(),
});

export type HouseholdProfile = z.infer<typeof householdProfileSchema>;
export type ChildInfo = z.infer<typeof childSchema>;

export const PROFILE_FIELDS = Object.keys(householdProfileSchema.shape) as ProfileField[];
export type ProfileField = keyof HouseholdProfile;
