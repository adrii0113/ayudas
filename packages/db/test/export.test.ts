import type { Benefit } from "@tetoca/core";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shardFor, writeExport } from "../src/export";
import {
  buildTerritoryRows,
  linkBenefitToRegistry,
  seedParameters,
  seedTerritories,
  upsertDetectedEdition,
} from "../src/registry";
import { publishBenefit, saveDraft, upsertSeedBenefit } from "../src/repository";
import { createTestDb } from "../src/testing";

const benefit: Benefit = {
  id: "bono",
  slug: "bono",
  title: "Bono",
  summary: "Una ayuda de prueba para los tests de exportación.",
  level: "regional",
  region: "CL",
  category: "energy",
  kind: "permanent",
  amount: { type: "percent", min: 42.5, text: "42,5 %" },
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

async function populated() {
  const db = await createTestDb();
  await seedTerritories(
    db,
    buildTerritoryRows([{ ine: "36013", name: "Covelo", provinceIne: "36" }]),
  );
  await seedParameters(db);
  await upsertSeedBenefit(db, benefit);
  await linkBenefitToRegistry(db, benefit);
  await upsertDetectedEdition(db, {
    bdnsCode: "935312",
    title: "Ayudas al estudio",
    publishedAt: "2026-10-01",
    programType: "grant_call",
    territoryId: "mun:36013",
    organism: {
      adminLevel: "municipal",
      sourceKey: "LOCAL / COVELO / AYUNTAMIENTO DE COVELO",
      name: "AYUNTAMIENTO DE COVELO",
      parentName: "COVELO",
      territoryId: "mun:36013",
    },
  });
  return db;
}

describe("git export", () => {
  it("shards by autonomous community", () => {
    expect(shardFor("mun:36013")).toBe("ccaa-12-galicia");
    expect(shardFor("ccaa:07")).toBe("ccaa-07-castilla-y-leon");
    expect(shardFor("es")).toBe("es");
  });

  it("is deterministic and never exports reviewer identities", async () => {
    const db = await populated();
    const draftId = await saveDraft(db, { ...benefit, title: "Bono (revisado)" });
    await publishBenefit(db, draftId, "ana.revisora@example.org");

    const a = mkdtempSync(join(tmpdir(), "export-a-"));
    const b = mkdtempSync(join(tmpdir(), "export-b-"));
    const manifest = await writeExport(db, a);
    await writeExport(db, b);

    expect(manifest).toMatchObject({
      programs: 2,
      byTrustLevel: { detected: 1, human_verified: 1 },
      byShard: { "ccaa-07-castilla-y-leon": 1, "ccaa-12-galicia": 1 },
    });
    expect(readdirSync(join(a, "programs")).sort()).toEqual([
      "ccaa-07-castilla-y-leon.ndjson",
      "ccaa-12-galicia.ndjson",
    ]);
    for (const file of ["manifest.json", "programs/ccaa-07-castilla-y-leon.ndjson"]) {
      expect(readFileSync(join(a, file), "utf8")).toBe(readFileSync(join(b, file), "utf8"));
    }
    const all = readdirSync(join(a, "programs"))
      .map((f) => readFileSync(join(a, "programs", f), "utf8"))
      .join("");
    expect(all).not.toContain("ana.revisora@example.org");
    const bono = JSON.parse(
      readFileSync(join(a, "programs/ccaa-07-castilla-y-leon.ndjson"), "utf8"),
    );
    expect(bono).toMatchObject({
      slug: "bono",
      trustLevel: "human_verified",
      revision: { version: 2, content: { title: "Bono (revisado)" } },
    });
  });
});
