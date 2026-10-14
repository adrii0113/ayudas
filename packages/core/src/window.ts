import type { Benefit } from "./benefit";

export type WindowStatus = "permanent" | "open" | "upcoming" | "closed" | "unknown";

/** Today's date as YYYY-MM-DD in Spain's peninsular time zone. */
export function todayInSpain(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

/**
 * Whether a benefit can be applied for on a given date. Dates are compared as
 * YYYY-MM-DD strings; `closesAt` is inclusive.
 */
export function getWindowStatus(
  benefit: Pick<Benefit, "kind" | "window">,
  today: string,
): WindowStatus {
  if (benefit.kind === "permanent") return "permanent";
  const { opensAt, closesAt } = benefit.window ?? {};
  if (closesAt && today > closesAt.slice(0, 10)) return "closed";
  if (opensAt && today < opensAt.slice(0, 10)) return "upcoming";
  if (opensAt || closesAt) return "open";
  return "unknown";
}
