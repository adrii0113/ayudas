import {
  AUTONOMOUS_COMMUNITIES,
  CONSTANTS_WITH_SOURCES,
  PROVINCES,
  benefitTerritoryId,
  deriveProgramType,
  editionStatus,
  needsHumanReview,
  territoryAncestors,
  territoryId,
  todayInSpain,
  type AdminLevel,
  type Benefit,
  type TrustLevel,
} from "@tetoca/core";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "./catalog";
import type { Database } from "./client";
import { stableStringify } from "./stable";
import { benefits, editions, organisms, parameters, programs, territories } from "./schema";

type NewTerritory = typeof territories.$inferInsert;

export function loadMunicipalities(): { ine: string; name: string; provinceIne: string }[] {
  const file = join(findRepoRoot(), "data", "reference", "municipalities.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { municipalities: never[] }).municipalities;
}

/** Country, autonomous communities, provinces and every INE municipality. */
export function buildTerritoryRows(municipalities = loadMunicipalities()): NewTerritory[] {
  const rows: NewTerritory[] = [{ id: "es", level: "country", name: "España" }];
  for (const c of AUTONOMOUS_COMMUNITIES) {
    rows.push({
      id: territoryId.region(c.ine),
      level: "region",
      name: c.name,
      parentId: "es",
      ineCode: c.ine,
      isoCode: c.iso,
      nutsCodes: [c.nuts2],
      fiscalRegime: c.fiscalRegime,
    });
  }
  const provinces = new Map(PROVINCES.map((p) => [p.ine, p]));
  for (const p of PROVINCES) {
    rows.push({
      id: territoryId.province(p.ine),
      level: "province",
      name: p.name,
      parentId: territoryId.region(p.ccaaIne),
      ineCode: p.ine,
      nutsCodes: p.nuts3,
      fiscalRegime: p.fiscalRegime,
    });
  }
  for (const m of municipalities) {
    const province = provinces.get(m.provinceIne);
    if (!province) throw new Error(`Municipality ${m.ine} has unknown province ${m.provinceIne}`);
    rows.push({
      id: territoryId.municipality(m.ine),
      level: "municipality",
      name: m.name,
      parentId: territoryId.province(m.provinceIne),
      ineCode: m.ine,
      fiscalRegime: province.fiscalRegime,
    });
  }
  return rows;
}

/** Idempotent: inserts new territories and refreshes names (INE renames happen). */
export async function seedTerritories(db: Database, rows = buildTerritoryRows()) {
  for (let i = 0; i < rows.length; i += 1000) {
    await db
      .insert(territories)
      .values(rows.slice(i, i + 1000))
      .onConflictDoUpdate({
        target: territories.id,
        set: { name: sql`excluded.name`, parentId: sql`excluded.parent_id` },
      });
  }
  return rows.length;
}

/** Loads the official constants (IPREM, SMI…) into the parameters registry. */
export async function seedParameters(db: Database) {
  let count = 0;
  for (const { constants, sources } of CONSTANTS_WITH_SOURCES) {
    const { year, ...values } = constants;
    for (const [key, value] of Object.entries(values)) {
      const source = sources[key as keyof typeof sources];
      await db
        .insert(parameters)
        .values({
          key,
          validFrom: `${year}-01-01`,
          validTo: `${year}-12-31`,
          value: String(value),
          unit: source.unit,
          sourceLabel: source.label,
          sourceUrl: source.url,
        })
        .onConflictDoUpdate({
          target: [parameters.key, parameters.validFrom],
          set: { value: String(value), sourceLabel: source.label, sourceUrl: source.url },
        });
      count++;
    }
  }
  return count;
}

const LEVEL_TO_ADMIN: Record<Benefit["level"], AdminLevel> = {
  state: "state",
  regional: "regional",
  municipal: "municipal",
};

/** Trust level of a curated benefit: human only when a person signed it off. */
export function curatedTrustLevel(benefit: Pick<Benefit, "status" | "reviewedBy">): TrustLevel {
  return benefit.status === "published" && !needsHumanReview(benefit)
    ? "human_verified"
    : "extracted";
}

/**
 * Makes sure a curated benefit (YAML or admin) has its program and edition in
 * the registry, and links every stored revision of the slug to them.
 */
export async function linkBenefitToRegistry(
  db: Database,
  benefit: Benefit,
  today = todayInSpain(),
): Promise<{ programId: string; editionId: string }> {
  const trust = curatedTrustLevel(benefit);
  const type = deriveProgramType(benefit);
  const values = {
    slug: benefit.slug,
    title: benefit.title,
    type,
    category: benefit.category,
    beneficiaryTypes: ["individuals"],
    adminLevel: LEVEL_TO_ADMIN[benefit.level],
    territoryId: benefitTerritoryId(benefit),
    recurrence: benefit.kind === "permanent" ? ("permanent" as const) : ("annual" as const),
    trustLevel: trust,
    lastVerifiedAt: benefit.reviewedAt ? new Date(benefit.reviewedAt) : null,
    updatedAt: new Date(),
  };
  const [program] = await db
    .insert(programs)
    .values(values)
    // Drafts never overwrite what the published revision says about the program.
    .onConflictDoUpdate({
      target: programs.slug,
      set: benefit.status === "published" ? values : { updatedAt: new Date() },
    })
    .returning({ id: programs.id });

  // Curated benefits carry one edition per version of their content period.
  const period =
    benefit.window?.opensAt?.slice(0, 4) ?? (benefit.kind === "permanent" ? "permanent" : null);
  const existing = await db
    .select({ id: editions.id })
    .from(editions)
    .where(
      and(eq(editions.programId, program!.id), period ? eq(editions.period, period) : sql`true`),
    )
    .limit(1);
  const editionValues = {
    programId: program!.id,
    period,
    title: benefit.title,
    status: editionStatus(benefit.window, today),
    opensAt: benefit.window?.opensAt?.slice(0, 10) ?? null,
    closesAt: benefit.window?.closesAt?.slice(0, 10) ?? null,
    windowText: benefit.window?.text ?? null,
    officialUrl: benefit.officialUrl,
    beneficiaryTypes: ["individuals"],
    territoryIds: [values.territoryId],
    lastSeenAt: new Date(),
  };
  let editionId = existing[0]?.id;
  if (editionId) {
    await db.update(editions).set(editionValues).where(eq(editions.id, editionId));
  } else {
    const [row] = await db.insert(editions).values(editionValues).returning({ id: editions.id });
    editionId = row!.id;
  }

  await db
    .update(benefits)
    .set({ programId: program!.id, editionId })
    .where(eq(benefits.slug, benefit.slug));
  await db
    .update(benefits)
    .set({ trustLevel: trust })
    .where(and(eq(benefits.slug, benefit.slug), eq(benefits.version, benefit.version)));
  return { programId: program!.id, editionId };
}

export async function countByTrustLevel(db: Database) {
  return db
    .select({ trustLevel: programs.trustLevel, count: sql<number>`count(*)::int` })
    .from(programs)
    .groupBy(programs.trustLevel);
}

export async function getTerritories(db: Database, ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(territories).where(inArray(territories.id, ids));
}

export type DetectedEditionInput = {
  /** BDNS code; unique per edition. */
  bdnsCode: string;
  title: string;
  publishedAt: string | null;
  programType: (typeof programs.$inferInsert)["type"];
  /** Territory the program applies to (narrowest known). */
  territoryId: string;
  organism: {
    adminLevel: AdminLevel;
    sourceKey: string;
    name: string;
    parentName: string | null;
    territoryId: string;
  };
  detail?: {
    territoryIds: string[];
    beneficiaryTypes: string[];
    status: (typeof editions.$inferInsert)["status"];
    opensAt: string | null;
    closesAt: string | null;
    windowText: string | null;
    budgetTotal: number | null;
    officialUrl: string | null;
    regulatoryBasesUrl: string | null;
    raw: Record<string, unknown>;
  };
};

/** Closest ancestor of a territory id that exists in the table. */
async function existingTerritory(db: Database, id: string): Promise<string> {
  const chain = territoryAncestors(id);
  const rows = await db
    .select({ id: territories.id })
    .from(territories)
    .where(inArray(territories.id, chain));
  const present = new Set(rows.map((r) => r.id));
  return chain.find((t) => present.has(t)) ?? "es";
}

export async function upsertOrganism(db: Database, o: DetectedEditionInput["organism"]) {
  const territory = await existingTerritory(db, o.territoryId);
  const [row] = await db
    .insert(organisms)
    .values({ ...o, territoryId: territory })
    .onConflictDoUpdate({
      target: organisms.sourceKey,
      set: { name: o.name, parentName: o.parentName, territoryId: territory },
    })
    .returning({ id: organisms.id });
  return row!.id;
}

/**
 * Registers a call detected in an official source. New calls create a
 * `detected` program; known ones refresh their metadata. Programs above
 * `detected` (curated or verified) are never overwritten by raw source data,
 * but a change in the source is reported so verification can re-run.
 */
export async function upsertDetectedEdition(
  db: Database,
  input: DetectedEditionInput,
): Promise<{ programId: string; editionId: string; created: boolean; sourceChanged: boolean }> {
  const organismId = await upsertOrganism(db, input.organism);
  const territory = await existingTerritory(db, input.territoryId);
  const d = input.detail;
  const sourceHash = d ? createHash("sha256").update(stableStringify(d.raw)).digest("hex") : null;
  const detailFields = d
    ? {
        status: d.status,
        opensAt: d.opensAt,
        closesAt: d.closesAt,
        windowText: d.windowText,
        budgetTotal: d.budgetTotal === null ? null : String(d.budgetTotal),
        officialUrl: d.officialUrl,
        regulatoryBasesUrl: d.regulatoryBasesUrl,
        beneficiaryTypes: d.beneficiaryTypes,
        territoryIds: d.territoryIds,
        sourceMetadata: d.raw,
        sourceHash,
      }
    : {};

  const [existing] = await db.select().from(editions).where(eq(editions.bdnsCode, input.bdnsCode));
  if (existing) {
    const sourceChanged =
      !!sourceHash && !!existing.sourceHash && existing.sourceHash !== sourceHash;
    await db
      .update(editions)
      .set({
        title: input.title,
        publishedAt: input.publishedAt,
        lastSeenAt: new Date(),
        ...detailFields,
      })
      .where(eq(editions.id, existing.id));
    await db
      .update(programs)
      .set({
        title: input.title,
        type: input.programType,
        territoryId: territory,
        organismId,
        ...(d ? { beneficiaryTypes: d.beneficiaryTypes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(programs.id, existing.programId), eq(programs.trustLevel, "detected")));
    return { programId: existing.programId, editionId: existing.id, created: false, sourceChanged };
  }

  return db.transaction(async (tx) => {
    const [program] = await tx
      .insert(programs)
      .values({
        slug: `bdns-${input.bdnsCode}`,
        title: input.title,
        type: input.programType,
        beneficiaryTypes: d?.beneficiaryTypes ?? [],
        adminLevel: input.organism.adminLevel,
        territoryId: territory,
        organismId,
        trustLevel: "detected",
      })
      .onConflictDoUpdate({ target: programs.slug, set: { updatedAt: new Date() } })
      .returning({ id: programs.id });
    const [edition] = await tx
      .insert(editions)
      .values({
        programId: program!.id,
        title: input.title,
        bdnsCode: input.bdnsCode,
        period: input.publishedAt?.slice(0, 4) ?? null,
        publishedAt: input.publishedAt,
        ...detailFields,
      })
      .returning({ id: editions.id });
    return { programId: program!.id, editionId: edition!.id, created: true, sourceChanged: false };
  });
}

/** Editions known only from search results (no detail fetched yet). */
export async function listEditionsWithoutDetail(db: Database, limit = 500) {
  return db
    .select({ bdnsCode: editions.bdnsCode })
    .from(editions)
    .where(and(isNull(editions.sourceMetadata), isNotNull(editions.bdnsCode)))
    .orderBy(desc(editions.publishedAt))
    .limit(limit)
    .then((rows) => rows.map((r) => r.bdnsCode!));
}

/** Open or undated editions not refreshed since `before` (deadlines move). */
export async function listEditionsToRefresh(db: Database, before: Date, limit = 500) {
  return db
    .select({ bdnsCode: editions.bdnsCode })
    .from(editions)
    .where(
      and(
        isNotNull(editions.bdnsCode),
        inArray(editions.status, ["open", "announced", "unknown"]),
        lt(editions.lastSeenAt, before),
      ),
    )
    .orderBy(asc(editions.lastSeenAt))
    .limit(limit)
    .then((rows) => rows.map((r) => r.bdnsCode!));
}

export async function registryStats(db: Database) {
  const [counts] = await db
    .select({
      programs: sql<number>`(select count(*)::int from programs)`,
      editions: sql<number>`(select count(*)::int from editions)`,
      organisms: sql<number>`(select count(*)::int from organisms)`,
      withoutDetail: sql<number>`(select count(*)::int from editions where source_metadata is null and bdns_code is not null)`,
    })
    .from(sql`(select 1) as one`);
  return counts!;
}

export async function getProgramBySlug(db: Database, slug: string) {
  const [row] = await db.select().from(programs).where(eq(programs.slug, slug));
  return row;
}

export async function getEditionByBdnsCode(db: Database, bdnsCode: string) {
  const [row] = await db.select().from(editions).where(eq(editions.bdnsCode, bdnsCode));
  return row;
}
