import { householdProfileSchema, type HouseholdProfile } from "@tetoca/core";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Database } from "./client";
import {
  decrypt,
  emailHash,
  encrypt,
  hashToken,
  manageToken,
  newToken,
  verifyManageToken,
} from "./crypto";
import { alertDeliveries, alertSubscriptions } from "./schema";

export type Subscriber = {
  id: string;
  email: string;
  profile: HouseholdProfile;
  confirmedAt: Date;
  lastSentAt: Date | null;
  notifiedBenefitIds: Set<string>;
};

/**
 * Creates or refreshes a subscription and returns its id and the confirmation
 * token to email (only its hash is stored). Any change requires confirming
 * again (double opt-in).
 */
export async function createSubscription(
  db: Database,
  key: Buffer,
  input: { email: string; profile: HouseholdProfile; consentAt?: Date },
): Promise<{ id: string; confirmToken: string }> {
  const confirm = newToken();
  const hash = emailHash(input.email, key);
  const values = {
    emailHash: hash,
    emailEncrypted: encrypt(input.email.trim(), key),
    profileEncrypted: encrypt(JSON.stringify(input.profile), key),
    consentAt: input.consentAt ?? new Date(),
    confirmTokenHash: confirm.hash,
  };
  const [existing] = await db
    .select({ id: alertSubscriptions.id })
    .from(alertSubscriptions)
    .where(eq(alertSubscriptions.emailHash, hash));
  if (existing) {
    await db
      .update(alertSubscriptions)
      .set({ ...values, confirmedAt: null })
      .where(eq(alertSubscriptions.id, existing.id));
    return { id: existing.id, confirmToken: confirm.token };
  }
  // The manage token is derived from the id; store its hash for auditing.
  const [row] = await db
    .insert(alertSubscriptions)
    .values({ ...values, manageTokenHash: "" })
    .returning({ id: alertSubscriptions.id });
  await db
    .update(alertSubscriptions)
    .set({ manageTokenHash: hashToken(manageToken(row!.id, key)) })
    .where(eq(alertSubscriptions.id, row!.id));
  return { id: row!.id, confirmToken: confirm.token };
}

export async function confirmSubscription(db: Database, token: string): Promise<boolean> {
  const rows = await db
    .update(alertSubscriptions)
    .set({ confirmedAt: new Date(), confirmTokenHash: null })
    .where(eq(alertSubscriptions.confirmTokenHash, hashToken(token)))
    .returning({ id: alertSubscriptions.id });
  return rows.length > 0;
}

/** One-click unsubscribe: deletes the subscriber and its delivery history. */
export async function deleteSubscription(
  db: Database,
  key: Buffer,
  subscriptionId: string,
  token: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) return false;
  if (!verifyManageToken(subscriptionId, token, key)) return false;
  const rows = await db
    .delete(alertSubscriptions)
    .where(eq(alertSubscriptions.id, subscriptionId))
    .returning({ id: alertSubscriptions.id });
  return rows.length > 0;
}

export async function listConfirmedSubscribers(db: Database, key: Buffer): Promise<Subscriber[]> {
  const subs = await db
    .select()
    .from(alertSubscriptions)
    .where(isNotNull(alertSubscriptions.confirmedAt));
  const deliveries = await db
    .select({
      subscriptionId: alertDeliveries.subscriptionId,
      benefitId: alertDeliveries.benefitId,
    })
    .from(alertDeliveries);
  const out: Subscriber[] = [];
  for (const s of subs) {
    // A row that cannot be decrypted (e.g. wrong key) must not stop the others.
    let email: string;
    let profileJson: unknown;
    try {
      email = decrypt(s.emailEncrypted, key);
      profileJson = JSON.parse(decrypt(s.profileEncrypted, key));
    } catch {
      console.error(`Subscriber ${s.id} could not be decrypted; skipped`);
      continue;
    }
    const profile = householdProfileSchema.safeParse(profileJson);
    if (!profile.success) continue;
    out.push({
      id: s.id,
      email,
      profile: profile.data,
      confirmedAt: s.confirmedAt!,
      lastSentAt: s.lastSentAt,
      notifiedBenefitIds: new Set(
        deliveries.filter((d) => d.subscriptionId === s.id).map((d) => d.benefitId),
      ),
    });
  }
  return out;
}

/** Records that an email was sent with these benefits. */
export async function recordAlertSent(
  db: Database,
  subscriptionId: string,
  benefitIds: string[],
  sentAt = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    if (benefitIds.length) {
      await tx
        .insert(alertDeliveries)
        .values(benefitIds.map((benefitId) => ({ subscriptionId, benefitId, sentAt })))
        .onConflictDoNothing();
    }
    await tx
      .update(alertSubscriptions)
      .set({ lastSentAt: sentAt })
      .where(and(eq(alertSubscriptions.id, subscriptionId)));
  });
}
