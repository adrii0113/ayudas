import type { BenefitContent } from "./benefit";
import { ccaaByIso, territoryId } from "./territory";

/**
 * National registry vocabulary (see docs/sistema-de-datos.md).
 *
 * A Program is the stable identity of an aid ("Bono Nacimiento de Castilla y
 * León"); an Edition is one call or financial year; a Revision (the existing
 * `benefits` row) is an immutable, reviewable snapshot of an edition's content.
 */

export const PROGRAM_TYPES = [
  /** Cash benefit paid by an administration (IMV, prestación por nacimiento…). */
  "cash_benefit",
  /** Income tax deduction (state, regional or foral). */
  "tax_deduction",
  /** Grant awarded through a call with a deadline (subvención/convocatoria). */
  "grant_call",
  /** Discounted tariff or social bonus (bono social eléctrico/térmico…). */
  "social_tariff",
  /** Service, exemption or in-kind aid (dependencia, comedor, exenciones…). */
  "service",
  /** Prizes and contests: stored for completeness, hidden from aid search by default. */
  "prize",
  "other",
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

/** How far a record has been checked. Higher is more trusted. */
export const TRUST_LEVELS = ["detected", "extracted", "agent_verified", "human_verified"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export function trustRank(level: TrustLevel): number {
  return TRUST_LEVELS.indexOf(level);
}

export function atLeast(level: TrustLevel, minimum: TrustLevel): boolean {
  return trustRank(level) >= trustRank(minimum);
}

/** Who can apply. Mirrors the BDNS beneficiary types. */
export const BENEFICIARY_TYPES = [
  /** Personas físicas que no desarrollan actividad económica (households). */
  "individuals",
  /** PYME y personas físicas que desarrollan actividad económica. */
  "smes_and_self_employed",
  "large_companies",
  /** Personas jurídicas sin actividad económica (asociaciones, fundaciones…). */
  "non_profits",
  "unspecified",
] as const;
export type BeneficiaryType = (typeof BENEFICIARY_TYPES)[number];

/** BDNS beneficiary type id (GET /beneficiarios) → our vocabulary. */
export const BDNS_BENEFICIARY_TYPES: Record<number, BeneficiaryType> = {
  1: "individuals",
  2: "non_profits",
  3: "smes_and_self_employed",
  4: "large_companies",
  5: "unspecified",
};

export const ADMIN_LEVELS = ["state", "regional", "provincial", "municipal", "other"] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export const EDITION_STATUSES = ["announced", "open", "closed", "unknown"] as const;
export type EditionStatus = (typeof EDITION_STATUSES)[number];

export const RECURRENCES = ["permanent", "annual", "one_off", "irregular", "unknown"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

/** Program type of a curated benefit (explicit `programType` wins). */
export function deriveProgramType(content: BenefitContent): ProgramType {
  if (content.programType) return content.programType;
  if (content.slug.startsWith("deduccion-")) return "tax_deduction";
  if (content.slug.startsWith("bono-social-")) return "social_tariff";
  if (content.kind === "call") return "grant_call";
  return "cash_benefit";
}

/** Territory id a curated benefit applies to. */
export function benefitTerritoryId(content: BenefitContent): string {
  if (content.municipality) return territoryId.municipality(content.municipality);
  if (content.level !== "state" && content.region) {
    const ccaa = ccaaByIso(content.region);
    if (ccaa) return territoryId.region(ccaa.ine);
  }
  return territoryId.country();
}

/** Edition status on a given day from its application window. */
export function editionStatus(
  window: { opensAt?: string | null; closesAt?: string | null } | undefined,
  today: string,
  openFlag?: boolean,
): EditionStatus {
  const opens = window?.opensAt?.slice(0, 10);
  const closes = window?.closesAt?.slice(0, 10);
  if (closes && closes < today) return "closed";
  if (opens && opens > today) return "announced";
  if (opens || closes) return "open";
  if (openFlag !== undefined) return openFlag ? "open" : "closed";
  return "unknown";
}
