import { AUTONOMOUS_COMMUNITIES, territoryAncestors } from "@tetoca/core";
import { and, asc, eq, inArray } from "drizzle-orm";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "./client";
import { rowToBenefit } from "./repository";
import { benefits, editions, evidence, organisms, parameters, programs } from "./schema";
import { stableStringify } from "./stable";

/**
 * Deterministic export of the registry for a Git repository: one NDJSON file
 * per autonomous community (plus "es" for national programs), one program per
 * line, sorted by slug. The same data always produces the same bytes, so the
 * daily commit diff shows exactly which programs changed.
 *
 * Raw source metadata (e.g. full BDNS records) is not exported: it is public
 * and reproducible from the source, and would multiply the size.
 */

export type ExportedProgram = Record<string, unknown> & { slug: string; territoryId: string };

/** "ccaa-07-castilla-y-leon" for programs inside a community, "es" otherwise. */
export function shardFor(territoryId: string): string {
  const ccaa = territoryAncestors(territoryId).find((t) => t.startsWith("ccaa:"));
  if (!ccaa) return "es";
  const ine = ccaa.slice(5);
  const name = AUTONOMOUS_COMMUNITIES.find((c) => c.ine === ine)?.name ?? ine;
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `ccaa-${ine}-${slug}`;
}

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** Programs with their editions, current published revision and evidence. */
export async function collectExport(db: Database, batchSize = 2000): Promise<ExportedProgram[]> {
  const orgRows = await db.select().from(organisms);
  const orgById = new Map(orgRows.map((o) => [o.id, o]));
  const out: ExportedProgram[] = [];

  for (let offset = 0; ; offset += batchSize) {
    const batch = await db
      .select()
      .from(programs)
      .orderBy(asc(programs.slug))
      .limit(batchSize)
      .offset(offset);
    if (!batch.length) break;
    const ids = batch.map((p) => p.id);
    const eds = await db
      .select()
      .from(editions)
      .where(inArray(editions.programId, ids))
      .orderBy(asc(editions.period), asc(editions.bdnsCode));
    const revs = await db
      .select()
      .from(benefits)
      .where(and(inArray(benefits.programId, ids), eq(benefits.status, "published")));
    const evs = revs.length
      ? await db
          .select()
          .from(evidence)
          .where(
            inArray(
              evidence.benefitId,
              revs.map((r) => r.id),
            ),
          )
          .orderBy(asc(evidence.target))
      : [];

    for (const p of batch) {
      const organism = p.organismId ? orgById.get(p.organismId) : undefined;
      const revision = revs.find((r) => r.programId === p.id);
      out.push({
        slug: p.slug,
        title: p.title,
        type: p.type,
        category: p.category,
        beneficiaryTypes: [...p.beneficiaryTypes].sort(),
        adminLevel: p.adminLevel,
        territoryId: p.territoryId,
        organism: organism
          ? { name: organism.name, parent: organism.parentName, territoryId: organism.territoryId }
          : null,
        recurrence: p.recurrence,
        trustLevel: p.trustLevel,
        active: p.active,
        lastVerifiedAt: day(p.lastVerifiedAt),
        editions: eds
          .filter((e) => e.programId === p.id)
          .map((e) => ({
            period: e.period,
            title: e.title,
            bdnsCode: e.bdnsCode,
            status: e.status,
            opensAt: e.opensAt,
            closesAt: e.closesAt,
            windowText: e.windowText,
            budgetTotal: e.budgetTotal === null ? null : Number(e.budgetTotal),
            officialUrl: e.officialUrl,
            regulatoryBasesUrl: e.regulatoryBasesUrl,
            territoryIds: [...e.territoryIds].sort(),
            beneficiaryTypes: [...e.beneficiaryTypes].sort(),
            publishedAt: e.publishedAt,
          })),
        revision: revision
          ? {
              version: revision.version,
              trustLevel: revision.trustLevel,
              reviewedAt: day(revision.reviewedAt),
              // reviewedBy may hold a reviewer's email: never exported.
              content: (({
                id: _id,
                status: _s,
                version: _v,
                reviewedBy: _r,
                reviewedAt: _a,
                ...content
              }) => content)(rowToBenefit(revision)),
              evidence: evs
                .filter((e) => e.benefitId === revision.id)
                .map((e) => ({
                  target: e.target,
                  url: e.url,
                  quote: e.quote,
                  verified: e.verified,
                })),
            }
          : null,
      });
    }
  }
  return out;
}

export type ExportManifest = {
  format: "tetoca-registry/1";
  programs: number;
  editions: number;
  byTrustLevel: Record<string, number>;
  byShard: Record<string, number>;
  parameters: { key: string; validFrom: string; value: number; source: string }[];
};

/** Writes the export into `dir` (replacing previous .ndjson shards). */
export async function writeExport(db: Database, dir: string): Promise<ExportManifest> {
  const rows = await collectExport(db);
  const shards = new Map<string, string[]>();
  const byTrustLevel: Record<string, number> = {};
  let editionCount = 0;
  for (const row of rows) {
    const shard = shardFor(row.territoryId);
    if (!shards.has(shard)) shards.set(shard, []);
    shards.get(shard)!.push(stableStringify(row));
    byTrustLevel[String(row.trustLevel)] = (byTrustLevel[String(row.trustLevel)] ?? 0) + 1;
    editionCount += (row.editions as unknown[]).length;
  }

  const programsDir = join(dir, "programs");
  mkdirSync(programsDir, { recursive: true });
  for (const file of readdirSync(programsDir)) {
    if (file.endsWith(".ndjson")) rmSync(join(programsDir, file));
  }
  for (const [shard, lines] of [...shards].sort(([a], [b]) => a.localeCompare(b))) {
    writeFileSync(join(programsDir, `${shard}.ndjson`), `${lines.join("\n")}\n`);
  }

  const params = await db
    .select()
    .from(parameters)
    .orderBy(asc(parameters.key), asc(parameters.validFrom));
  const manifest: ExportManifest = {
    format: "tetoca-registry/1",
    programs: rows.length,
    editions: editionCount,
    byTrustLevel: Object.fromEntries(Object.entries(byTrustLevel).sort()),
    byShard: Object.fromEntries([...shards].map(([k, v]) => [k, v.length]).sort()),
    parameters: params.map((p) => ({
      key: p.key,
      validFrom: p.validFrom,
      value: Number(p.value),
      source: p.sourceLabel,
    })),
  };
  // No timestamp: an unchanged registry must produce an unchanged export.
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
