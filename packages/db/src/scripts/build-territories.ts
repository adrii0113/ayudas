/**
 * Builds data/reference/municipalities.json from the official INE dictionary of
 * municipalities (https://www.ine.es/daco/daco42/codmun/diccionarioYY.xlsx).
 *
 * Usage: tsx src/scripts/build-territories.ts [year=26]
 * The output is committed: it is public reference data and changes once a year.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { provinceByIne } from "@tetoca/core";
import { strFromU8, unzipSync } from "fflate";

const year = process.argv[2] ?? "26";
const url = `https://www.ine.es/daco/daco42/codmun/diccionario${year}.xlsx`;
const out = resolve(import.meta.dirname, "../../../../data/reference/municipalities.json");

export type MunicipalityRecord = { ine: string; name: string; provinceIne: string };

/** Minimal reader for the single-sheet INE workbook (shared strings + inline numbers). */
export function parseIneWorkbook(xlsx: Uint8Array): MunicipalityRecord[] {
  const files = unzipSync(xlsx);
  const shared = [
    ...strFromU8(files["xl/sharedStrings.xml"]!).matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) => [...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
  const rows: MunicipalityRecord[] = [];
  for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const c of row[1]!.matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<v>([\s\S]*?)<\/v>)?)/g,
    )) {
      const [, col, attrs, v] = c;
      if (v === undefined) continue;
      cells[col!] = attrs!.includes('t="s"') ? shared[Number(v)]! : v;
    }
    const [cpro, cmun, name] = [cells.B, cells.C, cells.E];
    if (!cpro || !cmun || !name || !/^\d+$/.test(cpro)) continue;
    const provinceIne = cpro.padStart(2, "0");
    rows.push({ ine: provinceIne + cmun.padStart(3, "0"), name: decode(name), provinceIne });
  }
  return rows.sort((a, b) => a.ine.localeCompare(b.ine));
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`INE download failed: HTTP ${res.status}`);
  const rows = parseIneWorkbook(new Uint8Array(await res.arrayBuffer()));
  const unknown = rows.filter((r) => !provinceByIne(r.provinceIne));
  if (unknown.length) throw new Error(`Unknown provinces: ${unknown.map((r) => r.ine).join(", ")}`);
  // One municipality per line keeps yearly diffs readable in Git.
  const lines = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  const meta = `"source": ${JSON.stringify(url)},\n  "retrievedAt": "${new Date().toISOString().slice(0, 10)}"`;
  writeFileSync(out, `{\n  ${meta},\n  "municipalities": [\n${lines}\n  ]\n}\n`);
  console.log(`Wrote ${rows.length} municipalities to ${out}`);
}
