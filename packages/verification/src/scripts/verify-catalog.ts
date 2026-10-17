/**
 * Publication gate for the curated catalog: runs the verification agents over
 * every published YAML benefit against its official sources and writes
 * data/verification/catalog.json. The web only shows benefits that passed
 * with their current content (see build-catalog).
 *
 *   pnpm --filter @tetoca/verification verify:catalog [--only slug,slug] [--no-llm]
 */
import { todayInSpain } from "@tetoca/core";
import {
  catalogContentHash,
  loadCatalog,
  loadVerificationReport,
  verificationReportPath,
  type VerificationReport,
} from "@tetoca/db/catalog";
import { AnthropicProvider } from "@tetoca/llm";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { checkBenefit, withGrace } from "../gate";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    "no-llm": { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
  },
});

const only = values.only?.split(",").map((s) => s.trim());
const llm =
  !values["no-llm"] && process.env.ANTHROPIC_API_KEY ? new AnthropicProvider() : undefined;
const today = todayInSpain();
const { benefits } = loadCatalog();
const targets = benefits.filter(
  (b) => b.status === "published" && (!only || only.includes(b.slug)),
);
const path = verificationReportPath();
const report: VerificationReport = loadVerificationReport(path);
// Drop entries for benefits that no longer exist.
for (const slug of Object.keys(report)) {
  if (!benefits.some((b) => b.slug === slug)) delete report[slug];
}

console.log(`Checking ${targets.length} benefits (LLM agents ${llm ? "on" : "off"})…`);
let next = 0;
async function worker() {
  while (next < targets.length) {
    const benefit = targets[next++]!;
    const result = await checkBenefit(benefit, { llm }, today);
    const attempt = {
      version: benefit.version,
      contentHash: catalogContentHash(benefit),
      passed: result.passed,
      checkedAt: today,
      agents: result.agents,
      findings: result.findings.map(({ agent, severity, message, field, sourceUrl }) => ({
        agent,
        severity,
        message,
        ...(field ? { field } : {}),
        ...(sourceUrl ? { sourceUrl } : {}),
      })),
      models: result.models,
    };
    report[benefit.slug] = withGrace(report[benefit.slug], attempt, today);
    const kept = !result.passed && report[benefit.slug]!.passed;
    const mark = result.passed ? "✓" : kept ? "~" : "✗";
    console.log(
      `${mark} ${benefit.slug}${kept ? " (sources unreadable; previous pass kept)" : ""}`,
    );
    if (!result.passed) {
      for (const f of result.findings) console.log(`    ${f.agent}: ${f.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));

mkdirSync(dirname(path), { recursive: true });
const sorted = Object.fromEntries(Object.entries(report).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
const passed = targets.filter((b) => report[b.slug]?.passed).length;
console.log(`${passed}/${targets.length} passed → ${path}`);
