import { constants2026 } from "./constants.2026";
import type { OfficialConstants } from "./types";

export * from "./types";

const BY_YEAR: Record<number, OfficialConstants> = {
  2026: constants2026,
};

export const LATEST_CONSTANTS_YEAR = Math.max(...Object.keys(BY_YEAR).map(Number));

/**
 * Returns the official constants for a year. Throws for unknown years instead
 * of silently falling back, so a missing yearly update is noticed.
 */
export function getConstants(year: number = LATEST_CONSTANTS_YEAR): OfficialConstants {
  const constants = BY_YEAR[year];
  if (!constants) {
    throw new Error(`No official constants configured for year ${year}`);
  }
  return constants;
}

/**
 * Constants in force for a year: that year's values or, if not configured yet,
 * the latest previous year (official values stay in force until replaced).
 */
export function getConstantsInForce(year: number): OfficialConstants {
  const years = Object.keys(BY_YEAR)
    .map(Number)
    .filter((y) => y <= year)
    .sort((a, b) => b - a);
  return getConstants(years[0] ?? LATEST_CONSTANTS_YEAR);
}
