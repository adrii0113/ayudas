import type { Benefit } from "@tetoca/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../src/client";
import {
  archiveBenefit,
  getBenefitById,
  listAllVersions,
  listBenefitsByStatus,
  listPublishedBenefits,
  publishBenefit,
  saveDraft,
  toContent,
  upsertSeedBenefit,
} from "../src/repository";
import { createTestDb } from "../src/testing";

const benefit: Benefit = {
  id: "bono",
  slug: "bono",
  title: "Bono",
  summary: "Una ayuda de prueba para los tests.",
  level: "state",
  category: "energy",
  kind: "permanent",
  amount: { type: "percent", min: 42.5, text: "42,5 %" },
  eligibility: { all: [{ field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" }] },
  otherRequirements: [],
  documents: [],
  steps: [],
  officialUrl: "https://example.org",
  sources: [{ url: "https://example.org", retrievedAt: "2026-10-14" }],
  faq: [],
  status: "published",
  version: 1,
  reviewedBy: "admin",
  reviewedAt: "2026-10-14",
};

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("benefit repository", () => {
  it("seeds idempotently and refuses silent overwrites", async () => {
    expect(await upsertSeedBenefit(db, benefit)).toBe("inserted");
    expect(await upsertSeedBenefit(db, benefit)).toBe("unchanged");
    expect(await upsertSeedBenefit(db, { ...benefit, title: "Changed" })).toBe("conflict");
    const published = await listPublishedBenefits(db);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ slug: "bono", version: 1, reviewedAt: "2026-10-14" });
  });

  it("a new seeded version archives the previous published one", async () => {
    await upsertSeedBenefit(db, benefit);
    await upsertSeedBenefit(db, { ...benefit, version: 2, title: "Bono 2027" });
    const versions = await listAllVersions(db, "bono");
    expect(versions.map((v) => [v.version, v.status])).toEqual([
      [2, "published"],
      [1, "archived"],
    ]);
  });

  it("drafts are versioned, editable, and published only by review", async () => {
    await upsertSeedBenefit(db, benefit);
    const draftId = await saveDraft(db, toContent({ ...benefit, title: "Bono revisado" }));
    expect((await getBenefitById(db, draftId))?.benefit).toMatchObject({
      version: 2,
      status: "draft",
    });

    // Editing a draft updates it in place.
    expect(await saveDraft(db, toContent({ ...benefit, title: "Bono v2" }), { draftId })).toBe(
      draftId,
    );
    expect((await listBenefitsByStatus(db, "draft"))[0]?.title).toBe("Bono v2");

    await publishBenefit(db, draftId, "reviewer@example.org");
    const published = await listPublishedBenefits(db);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ title: "Bono v2", reviewedBy: "reviewer@example.org" });
    await expect(publishBenefit(db, draftId, "x")).rejects.toThrow(/Only drafts/);
    await expect(publishBenefit(db, "00000000-0000-0000-0000-000000000000", "x")).rejects.toThrow(
      /not found/,
    );
  });

  it("editing a published benefit creates a new draft instead of modifying it", async () => {
    await upsertSeedBenefit(db, benefit);
    const [pub] = await listPublishedBenefits(db);
    const id = await saveDraft(db, toContent({ ...benefit, title: "Nuevo" }), { draftId: pub!.id });
    expect(id).not.toBe(pub!.id);
    expect((await listPublishedBenefits(db))[0]?.title).toBe("Bono");
  });

  it("archives", async () => {
    await upsertSeedBenefit(db, benefit);
    const [pub] = await listPublishedBenefits(db);
    await archiveBenefit(db, pub!.id);
    expect(await listPublishedBenefits(db)).toHaveLength(0);
  });
});
