/**
 * Ingests recent BDNS calls for individuals in the configured regions.
 *
 *   pnpm --filter @tetoca/ingestion ingest:bdns [--since YYYY-MM-DD] [--limit N] [--memory]
 *
 * --memory uses an in-memory database (PGlite) to try it without Postgres.
 */
import { REGIONS } from "@tetoca/core";
import { createDb, listSourceDocuments, type Database } from "@tetoca/db";
import { parseArgs } from "node:util";
import { ingestBdns } from "../bdns/ingest";

const { values } = parseArgs({
  options: {
    since: { type: "string" },
    limit: { type: "string", default: "200" },
    memory: { type: "boolean", default: false },
  },
});

const since =
  values.since ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

let db: Database;
if (values.memory) {
  const { createTestDb } = await import("@tetoca/db/testing");
  db = await createTestDb();
} else {
  db = createDb();
}

for (const region of REGIONS) {
  console.log(`Ingesting BDNS calls for ${region.name} since ${since}…`);
  const result = await ingestBdns({
    db,
    regionId: region.bdnsRegionId,
    since,
    limit: Number(values.limit),
    municipalities: region.municipalities.map((m) => m.name),
    log: console.log,
  });
  console.log(
    `${region.name}: seen ${result.seen}, skipped ${result.skipped}, unchanged ${result.unchanged}, new ${result.created.length}` +
      ` (${result.created.filter((c) => c.needsManualReview).length} need manual review)`,
  );
}

if (values.memory) {
  for (const d of await listSourceDocuments(db, 3)) {
    console.log(`\n--- ${d.externalId} (${d.text.length} chars)\n${d.text.slice(0, 600)}`);
  }
} else {
  await (db as { $client: { end: () => Promise<void> } }).$client.end();
}
