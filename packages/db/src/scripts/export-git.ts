/**
 * Writes the deterministic registry export (see src/export.ts).
 *
 *   pnpm --filter @tetoca/db export:git [--out DIR] [--memory]
 *
 * The daily workflow (.github/workflows/export.yml) runs this inside a
 * checkout of the data repository and commits only when something changed.
 */
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { findRepoRoot, loadCatalog } from "../catalog";
import { createDb, type Database } from "../client";
import { writeExport } from "../export";
import { linkBenefitToRegistry, seedParameters, seedTerritories } from "../registry";
import { upsertSeedBenefit } from "../repository";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    memory: { type: "boolean", default: false },
  },
});

const out = resolve(values.out ?? `${findRepoRoot()}/data/export`);
let db: Database;
if (values.memory) {
  const { createTestDb } = await import("../testing");
  db = await createTestDb();
  await seedTerritories(db);
  await seedParameters(db);
  for (const benefit of loadCatalog().benefits) {
    await upsertSeedBenefit(db, benefit);
    await linkBenefitToRegistry(db, benefit);
  }
} else {
  db = createDb();
}

const manifest = await writeExport(db, out);
console.log(`Exported ${manifest.programs} programs (${manifest.editions} editions) to ${out}`);
console.log(manifest.byTrustLevel);
if (!values.memory) await db.$client.end();
