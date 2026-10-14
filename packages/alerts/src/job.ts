import { selectAlertMatches } from "@tetoca/core";
import {
  listConfirmedSubscribers,
  listPublishedBenefits,
  manageToken,
  recordAlertSent,
  type Database,
} from "@tetoca/db";
import type { Mailer } from "./mailer";
import { alertEmail } from "./templates";

const manageQuery = (id: string, key: Buffer) => `id=${id}&token=${manageToken(id, key)}`;

/** Page with a "delete my data" button (linked in the email body). */
export function deleteUrl(site: string, subscriptionId: string, key: Buffer): string {
  return `${site}/alertas/baja?${manageQuery(subscriptionId, key)}`;
}

/** RFC 8058 one-click endpoint (POST) used by mail clients' unsubscribe button. */
export function oneClickUnsubscribeUrl(site: string, subscriptionId: string, key: Buffer): string {
  return `${site}/api/alertas/baja?${manageQuery(subscriptionId, key)}`;
}

/**
 * Daily alerts job: for each confirmed subscriber, email new or reopened
 * benefits that are eligible/almost for their profile (max. one per week).
 */
export async function runAlerts(options: {
  db: Database;
  key: Buffer;
  mailer: Mailer;
  siteUrl: string;
  now?: Date;
}): Promise<{ subscribers: number; emailsSent: number; failures: number }> {
  const { db, key, mailer, siteUrl } = options;
  const now = options.now ?? new Date();
  const [benefits, subscribers] = await Promise.all([
    listPublishedBenefits(db),
    listConfirmedSubscribers(db, key),
  ]);
  let emailsSent = 0;
  let failures = 0;
  for (const s of subscribers) {
    const matches = selectAlertMatches({
      profile: s.profile,
      benefits,
      notified: s.notifiedBenefitIds,
      since: s.lastSentAt ?? s.confirmedAt,
      lastSentAt: s.lastSentAt,
      now,
    });
    if (!matches.length) continue;
    try {
      await mailer.send(
        alertEmail(s.email, matches, {
          site: siteUrl,
          deleteUrl: deleteUrl(siteUrl, s.id, key),
          oneClickUrl: oneClickUnsubscribeUrl(siteUrl, s.id, key),
        }),
      );
      await recordAlertSent(
        db,
        s.id,
        matches.map((m) => m.benefit.id),
        now,
      );
      emailsSent++;
    } catch (err) {
      failures++;
      console.error(`Alert to subscriber ${s.id} failed: ${(err as Error).message}`);
    }
  }
  return { subscribers: subscribers.length, emailsSent, failures };
}
