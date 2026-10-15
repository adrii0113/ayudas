/**
 * Writes the published benefits of the YAML catalog to a JSON file consumed by
 * the web app when no database is configured. Usage: build-catalog <outFile>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadCatalog, loadVerificationReport, validVerification } from "../catalog";

const out = process.argv[2];
if (!out) throw new Error("Usage: build-catalog <outFile>");

const { benefits, issues } = loadCatalog();
if (issues.length) {
  for (const issue of issues) console.error(`✗ ${issue.file}: ${issue.message}`);
  process.exit(1);
}
// Owner decision (2026-10-15): no human review. Only benefits that passed the
// automatic verification gate with their current content are shown.
const report = loadVerificationReport();
const published = benefits.flatMap((b) => {
  if (b.status !== "published") return [];
  const v = validVerification(b, report);
  return v ? [{ ...b, verifiedAt: v.checkedAt }] : [];
});
const skipped = benefits.filter((b) => b.status === "published").length - published.length;
if (skipped)
  console.warn(`${skipped} published benefits hidden: not verified for their current content`);
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), JSON.stringify(published, null, 2) + "\n");
console.log(`Wrote ${published.length} published benefits to ${out}`);
