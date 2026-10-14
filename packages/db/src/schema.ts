import type { BenefitContent } from "@tetoca/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const benefitStatus = pgEnum("benefit_status", ["draft", "published", "archived"]);
export const sourceKind = pgEnum("source_kind", ["bdns", "bocyl", "boe", "municipal", "manual"]);
export const extractionStatus = pgEnum("extraction_status", [
  "succeeded",
  "invalid_output",
  "failed",
]);

/**
 * Benefits are versioned: a new row per call/financial year. Rows are never
 * overwritten once published; edits create a new version.
 */
export const benefits = pgTable(
  "benefits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Optional, for future white-label tenants (no multi-tenant logic yet). */
    tenantId: text("tenant_id"),
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    status: benefitStatus("status").notNull().default("draft"),
    /** Validated with benefitContentSchema from @tetoca/core. */
    content: jsonb("content").$type<BenefitContent>().notNull(),
    // Denormalised for listing/filtering.
    title: text("title").notNull(),
    category: text("category").notNull(),
    level: text("level").notNull(),
    region: text("region"),
    opensAt: date("opens_at"),
    closesAt: date("closes_at"),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id),
    extractionId: uuid("extraction_id").references(() => extractions.id),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("benefits_slug_version_idx").on(t.slug, t.version),
    // At most one published version per slug.
    uniqueIndex("benefits_one_published_idx")
      .on(t.slug)
      .where(sql`${t.status} = 'published'`),
    index("benefits_status_idx").on(t.status),
    index("benefits_closes_at_idx").on(t.closesAt),
  ],
);

/** Original documents (calls, regulatory bases) kept for traceability. */
export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceKind("source").notNull(),
    /** e.g. BDNS code ("933778"). */
    externalId: text("external_id"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    /** Plain text used for extraction. */
    text: text("text").notNull(),
    /** sha256 of `text`; used to deduplicate and to cache LLM extractions. */
    contentHash: text("content_hash").notNull(),
    mimeType: text("mime_type"),
    /** True if text could not be extracted (e.g. scanned PDF): needs manual review. */
    needsManualReview: boolean("needs_manual_review").notNull().default(false),
    /** Raw metadata returned by the source (e.g. BDNS JSON). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("source_documents_hash_idx").on(t.contentHash),
    index("source_documents_external_idx").on(t.source, t.externalId),
  ],
);

/** One LLM extraction attempt over a source document. */
export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => sourceDocuments.id),
    /** Hash of the input document; same hash + prompt version → cached result. */
    inputHash: text("input_hash").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    status: extractionStatus("status").notNull(),
    output: jsonb("output"),
    uncertainties: jsonb("uncertainties").$type<string[]>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(1),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("extractions_cache_idx").on(t.inputHash, t.promptVersion)],
);

/**
 * Alert subscribers. Email and profile are encrypted at rest (AES-256-GCM, see
 * crypto.ts); `emailHash` (HMAC) allows lookups without decrypting.
 */
export const alertSubscriptions = pgTable(
  "alert_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id"),
    emailHash: text("email_hash").notNull(),
    emailEncrypted: text("email_encrypted").notNull(),
    profileEncrypted: text("profile_encrypted").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    confirmTokenHash: text("confirm_token_hash"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Token for one-click unsubscribe + delete. */
    manageTokenHash: text("manage_token_hash").notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("alert_subscriptions_email_idx").on(t.emailHash)],
);

/** Which benefits were already notified to a subscriber (avoid repeats). */
export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => alertSubscriptions.id, { onDelete: "cascade" }),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => benefits.id),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("alert_deliveries_unique_idx").on(t.subscriptionId, t.benefitId)],
);
