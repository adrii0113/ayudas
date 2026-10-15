/**
 * National BDNS radar: registers every call (all administrations and
 * beneficiary types) as a `detected` program/edition.
 *
 *   pnpm --filter @tetoca/ingestion radar:bdns [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *        [--details N] [--refresh-days D] [--memory]
 *
 * Defaults: listing of the last 3 days, up to 500 detail requests, and refresh
 * of open calls not seen in 7 days. A one-year backfill is ~1,400 listing
 * requests plus ~70,000 detail requests (≈20 h at 1 request/s): run it in
 * chunks with --details.
 */
import { todayInSpain } from "@tetoca/core";
import {
  createDb,
  loadMunicipalities,
  registryStats,
  seedTerritories,
  type Database,
} from "@tetoca/db";
import { parseArgs } from "node:util";
import { BdnsClient } from "../bdns/client";
import { buildMunicipalityIndex } from "../bdns/normalize";
import { runBdnsRadar } from "../bdns/radar";

const { values } = parseArgs({
  options: {
    from: { type: "string" },
    to: { type: "string" },
    details: { type: "string", default: "500" },
    "refresh-days": { type: "string", default: "7" },
    memory: { type: "boolean", default: false },
  },
});

const today = todayInSpain();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

let db: Database;
if (values.memory) {
  const { createTestDb } = await import("@tetoca/db/testing");
  db = await createTestDb();
} else {
  db = createDb();
}
const municipalities = loadMunicipalities();
await seedTerritories(db);

const result = await runBdnsRadar({
  db,
  client: new BdnsClient(),
  municipalities: buildMunicipalityIndex(municipalities),
  from: values.from ?? daysAgo(3),
  to: values.to,
  maxDetails: Number(values.details),
  refreshBefore: new Date(Date.now() - Number(values["refresh-days"]) * 86_400_000),
  today,
  log: console.log,
});
console.log(await registryStats(db));
for (const e of result.errors.slice(0, 10)) console.error(`✗ ${e.bdnsCode}: ${e.message}`);
if (!values.memory) await db.$client.end();
