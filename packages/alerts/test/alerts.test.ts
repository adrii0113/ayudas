import type { Benefit } from "@tetoca/core";
import {
  confirmSubscription,
  createSubscription,
  decrypt,
  deleteSubscription,
  encrypt,
  listConfirmedSubscribers,
  manageToken,
  schema,
  upsertSeedBenefit,
  type Database,
} from "@tetoca/db";
import { createTestDb } from "@tetoca/db/testing";
import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { ConsoleMailer, confirmationEmail, runAlerts } from "../src";

const key = randomBytes(32);
const site = "https://tetoca.example";

const benefit = (slug: string, reviewedAt: string): Benefit => ({
  id: slug,
  slug,
  title: `Ayuda ${slug}`,
  summary: "Una ayuda de prueba para los tests.",
  level: "state",
  category: "income",
  kind: "permanent",
  amount: { type: "fixed", min: 100, text: "100 €" },
  eligibility: { all: [{ field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" }] },
  otherRequirements: [],
  documents: [],
  steps: [],
  officialUrl: "https://example.org",
  sources: [{ url: "https://example.org", retrievedAt: reviewedAt }],
  faq: [],
  status: "published",
  version: 1,
  reviewedBy: "admin",
  reviewedAt,
});

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
});

describe("crypto", () => {
  it("round-trips and uses random IVs", () => {
    const a = encrypt("hola@example.org", key);
    expect(a).not.toBe(encrypt("hola@example.org", key));
    expect(decrypt(a, key)).toBe("hola@example.org");
    expect(() => decrypt(a, randomBytes(32))).toThrow();
  });
});

describe("subscriptions", () => {
  it("stores email and profile encrypted, never in clear", async () => {
    await createSubscription(db, key, {
      email: "Ana@Example.org",
      profile: { region: "CL", applicantAge: 30 },
    });
    const [row] = await db.select().from(schema.alertSubscriptions);
    expect(JSON.stringify(row)).not.toContain("example.org");
    expect(JSON.stringify(row)).not.toContain("applicantAge");
  });

  it("requires confirmation (double opt-in) and deletes with one click", async () => {
    const { id, confirmToken } = await createSubscription(db, key, {
      email: "ana@example.org",
      profile: { region: "CL", applicantAge: 30 },
    });
    expect(await listConfirmedSubscribers(db, key)).toHaveLength(0);
    expect(await confirmSubscription(db, "wrong")).toBe(false);
    expect(await confirmSubscription(db, confirmToken)).toBe(true);
    expect(await confirmSubscription(db, confirmToken)).toBe(false); // single use
    const [sub] = await listConfirmedSubscribers(db, key);
    expect(sub).toMatchObject({ email: "ana@example.org", profile: { applicantAge: 30 } });

    expect(await deleteSubscription(db, key, id, "forged")).toBe(false);
    expect(await deleteSubscription(db, key, id, manageToken(id, key))).toBe(true);
    expect(await db.select().from(schema.alertSubscriptions)).toHaveLength(0);
  });

  it("re-subscribing the same email updates it and asks to confirm again", async () => {
    const first = await createSubscription(db, key, {
      email: "ana@example.org",
      profile: { region: "CL" },
    });
    await confirmSubscription(db, first.confirmToken);
    const second = await createSubscription(db, key, {
      email: " ANA@example.org ",
      profile: { region: "OTHER" },
    });
    expect(second.id).toBe(first.id);
    expect(await listConfirmedSubscribers(db, key)).toHaveLength(0);
  });

  it("confirmation email contains the link", () => {
    expect(confirmationEmail("a@b.c", `${site}/alertas/confirmar?token=x`).text).toContain(
      "confirmar?token=x",
    );
  });
});

describe("runAlerts", () => {
  it("emails new matching benefits once, max. weekly, with a delete link", async () => {
    const { confirmToken } = await createSubscription(db, key, {
      email: "ana@example.org",
      profile: { region: "CL", applicantAge: 30 },
    });
    await confirmSubscription(db, confirmToken);
    await upsertSeedBenefit(db, benefit("old", "2020-01-01"));
    await upsertSeedBenefit(db, benefit("nueva", "2099-01-01"));

    const mailer = new ConsoleMailer();
    const day1 = new Date("2099-01-02T08:00:00Z");
    expect(await runAlerts({ db, key, mailer, siteUrl: site, now: day1 })).toMatchObject({
      emailsSent: 1,
    });
    const email = mailer.sent[0]!;
    expect(email.subject).toBe("Nueva ayuda para ti: Ayuda nueva");
    expect(email.text).toContain(`${site}/ayudas/nueva`);
    expect(email.text).not.toContain("Ayuda old");
    expect(email.headers?.["List-Unsubscribe"]).toContain("/api/alertas/baja?id=");
    expect(email.text).toContain(`${site}/alertas/baja?id=`);

    // Another new benefit two days later: weekly cap.
    await upsertSeedBenefit(db, benefit("otra", "2099-01-03"));
    expect(
      (await runAlerts({ db, key, mailer, siteUrl: site, now: new Date("2099-01-04T08:00:00Z") }))
        .emailsSent,
    ).toBe(0);

    // A week later: only the one not sent yet.
    await runAlerts({ db, key, mailer, siteUrl: site, now: new Date("2099-01-10T08:00:00Z") });
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1]!.text).toContain("Ayuda otra");
    expect(mailer.sent[1]!.text).not.toContain("Ayuda nueva");
  });
});

describe("robustness", () => {
  it("skips subscribers encrypted with another key instead of failing the job", async () => {
    const other = await createSubscription(db, randomBytes(32), {
      email: "x@example.org",
      profile: { region: "CL" },
    });
    await confirmSubscription(db, other.confirmToken);
    const mine = await createSubscription(db, key, {
      email: "y@example.org",
      profile: { region: "CL" },
    });
    await confirmSubscription(db, mine.confirmToken);
    expect((await listConfirmedSubscribers(db, key)).map((s) => s.email)).toEqual([
      "y@example.org",
    ]);
  });
});
