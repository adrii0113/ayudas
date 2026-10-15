/**
 * Writes data/open-calls.json: open BDNS calls for individuals of each
 * community's government, shown on the web as "sin verificar".
 *
 *   pnpm --filter @tetoca/ingestion open-calls [--per-region N]
 */
import { todayInSpain } from "@tetoca/core";
import { findRepoRoot } from "@tetoca/db/catalog";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { BdnsClient } from "../bdns/client";
import { collectOpenCalls } from "../bdns/open-calls";

const { values } = parseArgs({ options: { "per-region": { type: "string", default: "40" } } });
const file = await collectOpenCalls({
  client: new BdnsClient(),
  today: todayInSpain(),
  perRegion: Number(values["per-region"]),
  log: console.log,
});
const out = join(findRepoRoot(), "data", "open-calls.json");
writeFileSync(out, `${JSON.stringify(file, null, 1)}\n`);
const total = Object.values(file.byRegion).reduce((n, c) => n + c.length, 0);
console.log(`Wrote ${total} open calls to ${out}`);
