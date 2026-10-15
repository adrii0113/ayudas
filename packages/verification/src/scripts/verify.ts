/**
 * Runs the verification agents over published revisions.
 *
 *   pnpm --filter @tetoca/verification verify [--limit N] [--memory] [--no-llm]
 *
 * --memory seeds an in-memory database with the curated catalog (try it
 * without Postgres). LLM agents run only with ANTHROPIC_API_KEY and without
 * --no-llm; otherwise they are recorded as skipped and nothing is promoted.
 */
import {
  createDb,
  getBenefitById,
  linkBenefitToRegistry,
  listRevisionsToVerify,
  seedTerritories,
  upsertSeedBenefit,
  type Database,
} from "@tetoca/db";
import { loadCatalog } from "@tetoca/db/catalog";
import { AnthropicProvider } from "@tetoca/llm";
import { parseArgs } from "node:util";
import { verifyRevision } from "../runner";

const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "50" },
    memory: { type: "boolean", default: false },
    "no-llm": { type: "boolean", default: false },
  },
});

let db: Database;
if (values.memory) {
  const { createTestDb } = await import("@tetoca/db/testing");
  db = await createTestDb();
  await seedTerritories(db);
  for (const benefit of loadCatalog().benefits) {
    await upsertSeedBenefit(db, benefit);
    await linkBenefitToRegistry(db, benefit);
  }
} else {
  db = createDb();
}

const llm =
  !values["no-llm"] && process.env.ANTHROPIC_API_KEY ? new AnthropicProvider() : undefined;
console.log(llm ? "LLM agents: on" : "LLM agents: off (deterministic checks only)");

const tally: Record<string, Record<string, number>> = {};
for (const id of await listRevisionsToVerify(db, Number(values.limit))) {
  const report = await verifyRevision(db, id, { llm });
  const problems = Object.entries(report.results)
    .filter(([, r]) => r.verdict === "fail" || r.verdict === "uncertain")
    .map(([agent, r]) => `${agent}=${r.verdict}`);
  const stored = await getBenefitById(db, id);
  console.log(
    `${report.decision.trustLevel.padEnd(15)} ${stored?.benefit.slug}${problems.length ? `  ⚠ ${problems.join(", ")}` : ""}`,
  );
  for (const [agent, r] of Object.entries(report.results)) {
    tally[agent] ??= {};
    tally[agent][r.verdict] = (tally[agent][r.verdict] ?? 0) + 1;
  }
  for (const [agent, r] of Object.entries(report.results)) {
    for (const f of r.findings.filter((f) => f.severity !== "info")) {
      console.log(`    ${agent}: ${f.message}${f.sourceUrl ? ` (${f.sourceUrl})` : ""}`);
    }
  }
}
console.log(tally);
if (!values.memory) await db.$client.end();
