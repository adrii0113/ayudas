/**
 * Background worker (pg-boss queues on Postgres, no Redis).
 *
 *   pnpm --filter @tetoca/ingestion worker
 *
 * - "ingest-bdns": daily at 06:00 (Europe/Madrid), stores new calls and
 *   enqueues one "extract-document" job per new readable document.
 * - "extract-document": LLM extraction into a draft (needs ANTHROPIC_API_KEY).
 *
 * In serverless deployments, run `ingest:bdns` + `extract` from a scheduled
 * GitHub Action instead (see .github/workflows/ingest.yml).
 */
import { REGIONS } from "@tetoca/core";
import { createDb } from "@tetoca/db";
import { extractDocument } from "@tetoca/extraction";
import { AnthropicProvider } from "@tetoca/llm";
import { PgBoss } from "pg-boss";
import { ingestBdns } from "../bdns/ingest";

const INGEST = "ingest-bdns";
const EXTRACT = "extract-document";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url);
const boss = new PgBoss(url);
boss.on("error", (err) => console.error("pg-boss error", err));
await boss.start();
await boss.createQueue(INGEST);
await boss.createQueue(EXTRACT);
await boss.schedule(INGEST, "0 6 * * *", null, { tz: "Europe/Madrid" });

await boss.work<null>(INGEST, async () => {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  for (const region of REGIONS) {
    const result = await ingestBdns({
      db,
      regionId: region.bdnsRegionId,
      since,
      municipalities: region.municipalities.map((m) => m.name),
      log: console.log,
    });
    for (const doc of result.created.filter((d) => !d.needsManualReview)) {
      await boss.send(EXTRACT, { documentId: doc.documentId });
    }
    console.log(`${region.name}: ${result.created.length} new documents`);
  }
});

if (process.env.ANTHROPIC_API_KEY) {
  const llm = new AnthropicProvider();
  await boss.work<{ documentId: string }>(EXTRACT, async ([job]) => {
    const outcome = await extractDocument({ db, llm, documentId: job!.data.documentId });
    console.log(job!.data.documentId, outcome.status);
  });
} else {
  console.warn("ANTHROPIC_API_KEY not set: extraction jobs will wait in the queue.");
}

console.log("Worker running");
