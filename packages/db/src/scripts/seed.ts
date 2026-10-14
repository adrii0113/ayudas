import { loadCatalog } from "../catalog";
import { createDb } from "../client";
import { upsertSeedBenefit } from "../repository";

const { benefits, issues } = loadCatalog();
if (issues.length) {
  for (const issue of issues) console.error(`✗ ${issue.file}: ${issue.message}`);
  process.exit(1);
}

const db = createDb();
let conflicts = 0;
for (const benefit of benefits) {
  const outcome = await upsertSeedBenefit(db, benefit);
  if (outcome === "conflict") {
    conflicts++;
    console.error(`✗ ${benefit.slug}@${benefit.version}: content changed, bump \`version\``);
  } else {
    console.log(`${outcome === "inserted" ? "+" : "="} ${benefit.slug}@${benefit.version}`);
  }
}
await db.$client.end();
process.exit(conflicts ? 1 : 0);
