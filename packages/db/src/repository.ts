import { benefitContentSchema, type Benefit, type BenefitContent } from "@tetoca/core";
import { and, asc, desc, eq, max } from "drizzle-orm";
import type { Database } from "./client";
import { linkBenefitToRegistry } from "./registry";
import { benefits } from "./schema";

type BenefitRow = typeof benefits.$inferSelect;

export function rowToBenefit(row: BenefitRow): Benefit {
  return {
    ...row.content,
    id: row.id,
    status: row.status,
    version: row.version,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString().slice(0, 10),
  };
}

function denormalised(content: BenefitContent) {
  return {
    title: content.title,
    category: content.category,
    level: content.level,
    region: content.region ?? null,
    opensAt: content.window?.opensAt?.slice(0, 10) ?? null,
    closesAt: content.window?.closesAt?.slice(0, 10) ?? null,
  };
}

/** Strips lifecycle fields, keeping only the validated content. */
export function toContent(benefit: Benefit | BenefitContent): BenefitContent {
  return benefitContentSchema.parse(benefit);
}

export async function listPublishedBenefits(db: Database): Promise<Benefit[]> {
  const rows = await db
    .select()
    .from(benefits)
    .where(eq(benefits.status, "published"))
    .orderBy(asc(benefits.title));
  return rows.map(rowToBenefit);
}

export async function listBenefitsByStatus(
  db: Database,
  status: Benefit["status"],
): Promise<Benefit[]> {
  const rows = await db
    .select()
    .from(benefits)
    .where(eq(benefits.status, status))
    .orderBy(asc(benefits.closesAt), asc(benefits.title));
  return rows.map(rowToBenefit);
}

export async function getBenefitById(db: Database, id: string) {
  const [row] = await db.select().from(benefits).where(eq(benefits.id, id));
  return row ? { benefit: rowToBenefit(row), row } : undefined;
}

async function nextVersion(db: Database, slug: string): Promise<number> {
  const [r] = await db
    .select({ v: max(benefits.version) })
    .from(benefits)
    .where(eq(benefits.slug, slug));
  return (r?.v ?? 0) + 1;
}

/**
 * Saves edited content as a new draft version. Published rows are never
 * modified in place; a draft can be overwritten while it is still a draft.
 */
export async function saveDraft(
  db: Database,
  content: BenefitContent,
  opts: { draftId?: string; sourceDocumentId?: string; extractionId?: string } = {},
): Promise<string> {
  const parsed = toContent(content);
  if (opts.draftId) {
    const existing = await getBenefitById(db, opts.draftId);
    if (existing?.row.status === "draft" && existing.row.slug === parsed.slug) {
      await db
        .update(benefits)
        .set({ content: parsed, ...denormalised(parsed), updatedAt: new Date() })
        .where(eq(benefits.id, opts.draftId));
      return opts.draftId;
    }
  }
  const [row] = await db
    .insert(benefits)
    .values({
      slug: parsed.slug,
      version: await nextVersion(db, parsed.slug),
      status: "draft",
      content: parsed,
      ...denormalised(parsed),
      sourceDocumentId: opts.sourceDocumentId,
      extractionId: opts.extractionId,
    })
    .returning({ id: benefits.id });
  return row!.id;
}

/** Publishes a draft (human review), archiving the previously published version. */
export async function publishBenefit(db: Database, id: string, reviewer: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(benefits).where(eq(benefits.id, id));
    if (!row) throw new Error(`Benefit ${id} not found`);
    if (row.status !== "draft") throw new Error(`Only drafts can be published (is ${row.status})`);
    await tx
      .update(benefits)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(benefits.slug, row.slug), eq(benefits.status, "published")));
    await tx
      .update(benefits)
      .set({
        status: "published",
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(benefits.id, id));
  });
  const published = await getBenefitById(db, id);
  if (published) await linkBenefitToRegistry(db, published.benefit);
}

export async function archiveBenefit(db: Database, id: string): Promise<void> {
  await db
    .update(benefits)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(benefits.id, id));
}

/** JSON with sorted keys (Postgres jsonb does not preserve key order). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export type SeedOutcome = "inserted" | "unchanged" | "conflict";

/**
 * Inserts a curated benefit (from YAML) if its slug/version is new. Existing
 * versions are never overwritten: changing content requires bumping `version`.
 */
export async function upsertSeedBenefit(db: Database, benefit: Benefit): Promise<SeedOutcome> {
  const content = toContent(benefit);
  const [existing] = await db
    .select()
    .from(benefits)
    .where(and(eq(benefits.slug, benefit.slug), eq(benefits.version, benefit.version)));
  if (existing) {
    return stableStringify(existing.content) === stableStringify(content)
      ? "unchanged"
      : "conflict";
  }
  await db.transaction(async (tx) => {
    if (benefit.status === "published") {
      await tx
        .update(benefits)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(benefits.slug, benefit.slug), eq(benefits.status, "published")));
    }
    await tx.insert(benefits).values({
      slug: benefit.slug,
      version: benefit.version,
      status: benefit.status,
      content,
      ...denormalised(content),
      reviewedBy: benefit.reviewedBy,
      reviewedAt: benefit.reviewedAt ? new Date(benefit.reviewedAt) : null,
    });
  });
  return "inserted";
}

export async function listAllVersions(db: Database, slug: string): Promise<Benefit[]> {
  const rows = await db
    .select()
    .from(benefits)
    .where(eq(benefits.slug, slug))
    .orderBy(desc(benefits.version));
  return rows.map(rowToBenefit);
}
