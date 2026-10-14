import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { extractions, sourceDocuments } from "./schema";

export type NewSourceDocument = typeof sourceDocuments.$inferInsert;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type Extraction = typeof extractions.$inferSelect;
export type NewExtraction = typeof extractions.$inferInsert;

/**
 * Stores a source document, deduplicated by content hash. Returns the stored
 * row and whether it was new.
 */
export async function saveSourceDocument(
  db: Database,
  doc: NewSourceDocument,
): Promise<{ document: SourceDocument; created: boolean }> {
  const [inserted] = await db
    .insert(sourceDocuments)
    .values(doc)
    .onConflictDoNothing({ target: sourceDocuments.contentHash })
    .returning();
  if (inserted) return { document: inserted, created: true };
  const [existing] = await db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.contentHash, doc.contentHash));
  return { document: existing!, created: false };
}

export async function findLatestDocument(
  db: Database,
  source: SourceDocument["source"],
  externalId: string,
): Promise<SourceDocument | undefined> {
  const [row] = await db
    .select()
    .from(sourceDocuments)
    .where(and(eq(sourceDocuments.source, source), eq(sourceDocuments.externalId, externalId)))
    .orderBy(desc(sourceDocuments.retrievedAt))
    .limit(1);
  return row;
}

export async function getSourceDocument(db: Database, id: string) {
  const [row] = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id));
  return row;
}

export async function listSourceDocuments(db: Database, limit = 100) {
  return db.select().from(sourceDocuments).orderBy(desc(sourceDocuments.retrievedAt)).limit(limit);
}

/** Successful extraction for the same input and prompt version (LLM cache). */
export async function findCachedExtraction(
  db: Database,
  inputHash: string,
  promptVersion: string,
): Promise<Extraction | undefined> {
  const [row] = await db
    .select()
    .from(extractions)
    .where(
      and(
        eq(extractions.inputHash, inputHash),
        eq(extractions.promptVersion, promptVersion),
        eq(extractions.status, "succeeded"),
      ),
    )
    .limit(1);
  return row;
}

export async function saveExtraction(db: Database, row: NewExtraction): Promise<Extraction> {
  const [inserted] = await db.insert(extractions).values(row).returning();
  return inserted!;
}

export async function getExtraction(db: Database, id: string) {
  const [row] = await db.select().from(extractions).where(eq(extractions.id, id));
  return row;
}

export async function listExtractionsForDocument(db: Database, documentId: string) {
  return db
    .select()
    .from(extractions)
    .where(eq(extractions.documentId, documentId))
    .orderBy(desc(extractions.createdAt));
}

/** Readable documents that have no extraction yet. */
export async function listDocumentsWithoutExtraction(db: Database, limit = 50) {
  const rows = await db
    .select({ id: sourceDocuments.id, extractionId: extractions.id })
    .from(sourceDocuments)
    .leftJoin(extractions, eq(extractions.documentId, sourceDocuments.id))
    .where(and(eq(sourceDocuments.needsManualReview, false), isNull(extractions.id)))
    .limit(limit);
  return rows.map((r) => r.id);
}
