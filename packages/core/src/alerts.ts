import type { Benefit } from "./benefit";
import { evaluate, type BenefitMatch } from "./matching";
import type { HouseholdProfile } from "./profile";

/** At most one alert email per subscriber in this many days. */
export const ALERT_MIN_INTERVAL_DAYS = 7;

export type AlertInput = {
  profile: HouseholdProfile;
  benefits: Benefit[];
  /** Benefit ids (versions) already notified to this subscriber. */
  notified: Set<string>;
  /** Last email sent, or when the subscription was confirmed. */
  since: Date;
  lastSentAt: Date | null;
  now: Date;
};

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Benefits worth an alert: published since the last email (or reopened as a
 * new call), matching the profile as eligible or almost, never sent before.
 * Returns [] if an email was sent less than a week ago.
 */
export function selectAlertMatches(input: AlertInput): BenefitMatch[] {
  const { lastSentAt, now } = input;
  if (lastSentAt && now.getTime() - lastSentAt.getTime() < ALERT_MIN_INTERVAL_DAYS * 86_400_000) {
    return [];
  }
  const since = day(input.since);
  const fresh = input.benefits.filter(
    (b) =>
      b.status === "published" &&
      !input.notified.has(b.id) &&
      ((b.reviewedAt ?? "") >= since || (b.window?.opensAt ?? "") >= since),
  );
  return evaluate(input.profile, fresh, { today: day(now) }).filter(
    (m) => m.status === "eligible" || m.status === "almost",
  );
}
