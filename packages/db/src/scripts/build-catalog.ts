/**
 * Writes the published benefits of the YAML catalog to a JSON file consumed by
 * the web app when no database is configured. Usage: build-catalog <outFile>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadCatalog } from "../catalog";

const out = process.argv[2];
if (!out) throw new Error("Usage: build-catalog <outFile>");

const { benefits, issues } = loadCatalog();
if (issues.length) {
  for (const issue of issues) console.error(`✗ ${issue.file}: ${issue.message}`);
  process.exit(1);
}
const published = benefits.filter((b) => b.status === "published");
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), JSON.stringify(published, null, 2) + "\n");
console.log(`Wrote ${published.length} published benefits to ${out}`);
