import { AUTONOMOUS_COMMUNITIES } from "./territory";

/**
 * Autonomous communities offered in the product (all of Spain). A region's
 * benefits live in /data/seed; municipalities are listed only where we curate
 * municipal benefits.
 */
export type RegionConfig = {
  /** ISO 3166-2:ES code, as stored in HouseholdProfile.region. */
  code: string;
  name: string;
  /** BDNS region id of the NUTS2 unit (GET /regiones on the SNPSAP API). */
  bdnsRegionId: number;
  municipalities: { ineCode: string; name: string }[];
};

/** BDNS region ids by NUTS2 code, from GET /regiones (checked 2026-10-15). */
const BDNS_REGION_IDS: Record<string, number> = {
  ES11: 3,
  ES12: 8,
  ES13: 10,
  ES21: 13,
  ES22: 17,
  ES23: 19,
  ES24: 21,
  ES30: 26,
  ES41: 29,
  ES42: 39,
  ES43: 45,
  ES51: 49,
  ES52: 54,
  ES53: 58,
  ES61: 63,
  ES62: 72,
  ES63: 74,
  ES64: 76,
  ES70: 79,
};

const MUNICIPALITIES: Record<string, RegionConfig["municipalities"]> = {
  CL: [{ ineCode: "47186", name: "Valladolid" }],
};

export const REGIONS: RegionConfig[] = AUTONOMOUS_COMMUNITIES.map((c) => ({
  code: c.iso,
  name: c.name,
  bdnsRegionId: BDNS_REGION_IDS[c.nuts2]!,
  municipalities: MUNICIPALITIES[c.iso] ?? [],
})).sort((a, b) => a.name.localeCompare(b.name, "es"));

export const DEFAULT_REGION = "CL";

export function getRegion(code: string): RegionConfig | undefined {
  return REGIONS.find((r) => r.code === code);
}
