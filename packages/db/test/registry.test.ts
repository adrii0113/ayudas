import type { Benefit } from "@tetoca/core";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  buildTerritoryRows,
  countByTrustLevel,
  curatedTrustLevel,
  linkBenefitToRegistry,
  seedParameters,
  seedTerritories,
} from "../src/registry";
import { publishBenefit, saveDraft, upsertSeedBenefit } from "../src/repository";
import { benefits, editions, parameters, programs, territories } from "../src/schema";
import { createTestDb } from "../src/testing";

const base: Benefit = {
  id: "bono-nacimiento-x",
  slug: "bono-nacimiento-x",
  title: "Bono Nacimiento X",
  summary: "Ayuda de prueba por nacimiento para los tests.",
  level: "municipal",
  region: "CL",
  municipality: "47186",
  category: "birth",
  kind: "call",
  amount: { type: "fixed", min: 500, text: "500 €" },
  window: { opensAt: "2026-01-01", closesAt: "2026-12-31" },
  eligibility: { all: [{ field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" }] },
  otherRequirements: [],
  documents: [],
  steps: [],
  officialUrl: "https://example.org",
  sources: [{ url: "https://example.org", retrievedAt: "2026-10-01" }],
  faq: [],
  status: "published",
  version: 1,
  reviewedBy: "claude-code (requiere revisión humana)",
};

describe("territories", () => {
  it("builds the full hierarchy from INE data", () => {
    const rows = buildTerritoryRows([{ ine: "47186", name: "Valladolid", provinceIne: "47" }]);
    expect(rows.filter((r) => r.level === "region")).toHaveLength(19);
    expect(rows.filter((r) => r.level === "province")).toHaveLength(52);
    expect(rows.find((r) => r.id === "mun:47186")).toMatchObject({
      parentId: "prov:47",
      fiscalRegime: "common",
    });
    expect(() => buildTerritoryRows([{ ine: "99001", name: "X", provinceIne: "99" }])).toThrow();
  });

  it("loads all 8,132 INE municipalities idempotently", async () => {
    const db = await createTestDb();
    const total = await seedTerritories(db);
    await seedTerritories(db);
    expect(total).toBe(1 + 19 + 52 + 8132);
    const [bilbao] = await db.select().from(territories).where(eq(territories.id, "mun:48020"));
    expect(bilbao).toMatchObject({ name: "Bilbao", fiscalRegime: "foral", parentId: "prov:48" });
  }, 30_000);
});

describe("registry", () => {
  it("loads official parameters with their sources", async () => {
    const db = await createTestDb();
    expect(await seedParameters(db)).toBe(7);
    const [iprem] = await db.select().from(parameters).where(eq(parameters.key, "iprem14"));
    expect(iprem).toMatchObject({ value: "8400.00", validFrom: "2026-01-01", unit: "EUR/year" });
  });

  it("creates program and edition for a curated benefit and links its revisions", async () => {
    const db = await createTestDb();
    await seedTerritories(
      db,
      buildTerritoryRows([{ ine: "47186", name: "Valladolid", provinceIne: "47" }]),
    );
    await upsertSeedBenefit(db, base);
    const { programId, editionId } = await linkBenefitToRegistry(db, base, "2026-10-15");
    const [program] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(program).toMatchObject({
      slug: "bono-nacimiento-x",
      type: "grant_call",
      adminLevel: "municipal",
      territoryId: "mun:47186",
      trustLevel: "extracted",
      recurrence: "annual",
    });
    const [edition] = await db.select().from(editions).where(eq(editions.id, editionId));
    expect(edition).toMatchObject({ period: "2026", status: "open", closesAt: "2026-12-31" });
    const [row] = await db.select().from(benefits).where(eq(benefits.slug, base.slug));
    expect(row).toMatchObject({ programId, editionId, trustLevel: "extracted" });

    // Linking again reuses the same program and edition.
    const again = await linkBenefitToRegistry(db, base, "2026-10-15");
    expect(again).toEqual({ programId, editionId });
  });

  it("marks a program human_verified when a person publishes it", async () => {
    const db = await createTestDb();
    const stateBenefit = {
      ...base,
      level: "state" as const,
      municipality: undefined,
      region: undefined,
    };
    await upsertSeedBenefit(db, stateBenefit);
    await linkBenefitToRegistry(db, stateBenefit);
    const draftId = await saveDraft(db, {
      ...stateBenefit,
      title: "Bono Nacimiento X (corregido)",
    });
    await publishBenefit(db, draftId, "ana@example.org");
    const [program] = await db.select().from(programs).where(eq(programs.slug, base.slug));
    expect(program).toMatchObject({ trustLevel: "human_verified", territoryId: "es" });
    const [row] = await db.select().from(benefits).where(eq(benefits.id, draftId));
    expect(row?.trustLevel).toBe("human_verified");
    expect(await countByTrustLevel(db)).toEqual([{ trustLevel: "human_verified", count: 1 }]);
  });

  it("only trusts sign-offs by people", () => {
    expect(curatedTrustLevel(base)).toBe("extracted");
    expect(curatedTrustLevel({ ...base, reviewedBy: "ana@example.org" })).toBe("human_verified");
    expect(curatedTrustLevel({ ...base, status: "draft", reviewedBy: "ana" })).toBe("extracted");
  });
});
