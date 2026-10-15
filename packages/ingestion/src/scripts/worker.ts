/**
 * Background worker (pg-boss queues on Postgres, no Redis).
 *
 *   pnpm --filter @tetoca/ingestion worker
 *
 * - "radar-bdns": daily at 05:00, registers every new BDNS call in Spain
 *   (all administrations and beneficiaries) as `detected`, and refreshes open calls.
 * - "ingest-bdns": daily at 06:00 (Europe/Madrid), stores new calls and
 *   enqueues one "extract-document" job per new readable document.
 * - "extract-document": LLM extraction into a draft (needs ANTHROPIC_API_KEY).
 * - "send-alerts": daily at 09:00, emails subscribers (needs ALERTS_ENCRYPTION_KEY).
 *
 * In serverless deployments, run `ingest:bdns` + `extract` from a scheduled
 * GitHub Action instead (see .github/workflows/ingest.yml).
 */
import { createMailer, runAlerts } from "@tetoca/alerts";
import { REGIONS, todayInSpain } from "@tetoca/core";
import { createDb, encryptionKey, loadMunicipalities, seedTerritories } from "@tetoca/db";
import { extractDocument } from "@tetoca/extraction";
import { AnthropicProvider } from "@tetoca/llm";
import { PgBoss } from "pg-boss";
import { BdnsClient } from "../bdns/client";
import { ingestBdns } from "../bdns/ingest";
import { buildMunicipalityIndex } from "../bdns/normalize";
import { runBdnsRadar } from "../bdns/radar";

const RADAR = "radar-bdns";
const INGEST = "ingest-bdns";
const EXTRACT = "extract-document";
const ALERTS = "send-alerts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url);
const boss = new PgBoss(url);
boss.on("error", (err) => console.error("pg-boss error", err));
await boss.start();
await boss.createQueue(RADAR);
await boss.createQueue(INGEST);
await boss.createQueue(EXTRACT);
await boss.schedule(RADAR, "0 5 * * *", null, { tz: "Europe/Madrid" });
await boss.schedule(INGEST, "0 6 * * *", null, { tz: "Europe/Madrid" });

const municipalityIndex = buildMunicipalityIndex(loadMunicipalities());
await boss.work<null>(RADAR, async () => {
  await seedTerritories(db);
  await runBdnsRadar({
    db,
    client: new BdnsClient(),
    municipalities: municipalityIndex,
    from: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
    maxDetails: 3000,
    refreshBefore: new Date(Date.now() - 7 * 86_400_000),
    today: todayInSpain(),
    log: console.log,
  });
});

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

if (process.env.ALERTS_ENCRYPTION_KEY) {
  await boss.createQueue(ALERTS);
  await boss.schedule(ALERTS, "0 9 * * *", null, { tz: "Europe/Madrid" });
  await boss.work(ALERTS, async () => {
    const result = await runAlerts({
      db,
      key: encryptionKey(),
      mailer: createMailer(),
      siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    });
    console.log("alerts", result);
  });
}

console.log("Worker running");
