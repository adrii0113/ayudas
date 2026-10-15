import {
  ADMIN_LEVELS,
  EDITION_STATUSES,
  PROGRAM_TYPES,
  RECURRENCES,
  TERRITORY_LEVELS,
  TRUST_LEVELS,
  type BenefitContent,
} from "@tetoca/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const benefitStatus = pgEnum("benefit_status", ["draft", "published", "archived"]);
export const trustLevel = pgEnum("trust_level", TRUST_LEVELS);
export const programType = pgEnum("program_type", PROGRAM_TYPES);
export const adminLevel = pgEnum("admin_level", ADMIN_LEVELS);
export const editionStatus = pgEnum("edition_status", EDITION_STATUSES);
export const recurrence = pgEnum("recurrence", RECURRENCES);
export const territoryLevel = pgEnum("territory_level", TERRITORY_LEVELS);
export const verificationVerdict = pgEnum("verification_verdict", [
  "pass",
  "fail",
  "uncertain",
  "skipped",
]);
export const verificationSubject = pgEnum("verification_subject", [
  "program",
  "edition",
  "revision",
]);
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
    /** Registry links: a benefits row is an immutable revision of an edition. */
    programId: uuid("program_id").references(() => programs.id),
    editionId: uuid("edition_id").references(() => editions.id),
    trustLevel: trustLevel("trust_level").notNull().default("extracted"),
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
    index("benefits_program_idx").on(t.programId),
  ],
);

/**
 * Spanish territorial units (INE codes). Ids: "es", "ccaa:07", "prov:47",
 * "mun:47186". Loaded from @tetoca/core and data/reference/municipalities.json.
 */
export const territories = pgTable(
  "territories",
  {
    id: text("id").primaryKey(),
    level: territoryLevel("level").notNull(),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    ineCode: text("ine_code"),
    isoCode: text("iso_code"),
    nutsCodes: text("nuts_codes").array(),
    fiscalRegime: text("fiscal_regime"),
  },
  (t) => [index("territories_parent_idx").on(t.parentId), index("territories_name_idx").on(t.name)],
);

/** Granting bodies, keyed by the BDNS organ hierarchy (DIR3 when known). */
export const organisms = pgTable(
  "organisms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminLevel: adminLevel("admin_level").notNull(),
    /** BDNS nivel1/nivel2/nivel3 joined with " / " (stable natural key). */
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    /** e.g. the municipality or ministry the organ belongs to (BDNS nivel2). */
    parentName: text("parent_name"),
    territoryId: text("territory_id").references(() => territories.id),
    dir3Code: text("dir3_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organisms_source_key_idx").on(t.sourceKey),
    index("organisms_territory_idx").on(t.territoryId),
  ],
);

/** Stable identity of an aid across years. */
export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    type: programType("type").notNull(),
    /** Household-oriented category (BENEFIT_CATEGORIES) when known. */
    category: text("category"),
    beneficiaryTypes: text("beneficiary_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    adminLevel: adminLevel("admin_level").notNull(),
    /** Territory where the aid applies (the whole subtree is covered). */
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.id),
    organismId: uuid("organism_id").references(() => organisms.id),
    recurrence: recurrence("recurrence").notNull().default("unknown"),
    trustLevel: trustLevel("trust_level").notNull().default("detected"),
    active: boolean("active").notNull().default(true),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("programs_slug_idx").on(t.slug),
    index("programs_territory_idx").on(t.territoryId),
    index("programs_trust_idx").on(t.trustLevel),
    index("programs_type_idx").on(t.type),
  ],
);

/** One call or financial year of a program. */
export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id),
    /** e.g. "2026" or "2026/2027". */
    period: text("period"),
    title: text("title").notNull(),
    /** BDNS code (e.g. "933778"); null for curated permanent benefits. */
    bdnsCode: text("bdns_code"),
    status: editionStatus("status").notNull().default("unknown"),
    opensAt: date("opens_at"),
    closesAt: date("closes_at"),
    /** Plain-language window when there are no exact dates. */
    windowText: text("window_text"),
    budgetTotal: numeric("budget_total", { precision: 16, scale: 2 }),
    officialUrl: text("official_url"),
    regulatoryBasesUrl: text("regulatory_bases_url"),
    beneficiaryTypes: text("beneficiary_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** All territories the edition targets (BDNS calls may list several). */
    territoryIds: text("territory_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Raw source metadata (e.g. BDNS detail JSON) for cross-checks. */
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>(),
    /** Hash of the normalised source metadata: changes trigger re-verification. */
    sourceHash: text("source_hash"),
    publishedAt: date("published_at"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("editions_bdns_idx").on(t.bdnsCode),
    index("editions_program_idx").on(t.programId),
    index("editions_closes_at_idx").on(t.closesAt),
    index("editions_status_idx").on(t.status),
  ],
);

/** Located quote that justifies a rule of a revision. */
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => benefits.id),
    /** Path of the rule in the eligibility tree (e.g. "all.0") or a field ("amount"). */
    target: text("target").notNull(),
    documentId: uuid("document_id").references(() => sourceDocuments.id),
    url: text("url"),
    quote: text("quote").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    /** True when the quote was found verbatim in the stored document. */
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_benefit_idx").on(t.benefitId)],
);

/** Official parameters (IPREM, SMI…) with validity periods. */
export const parameters = pgTable(
  "parameters",
  {
    key: text("key").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    value: numeric("value", { precision: 14, scale: 2 }).notNull(),
    unit: text("unit").notNull(),
    sourceLabel: text("source_label").notNull(),
    sourceUrl: text("source_url"),
  },
  (t) => [primaryKey({ columns: [t.key, t.validFrom] })],
);

/** Auditable record of every verification agent run. */
export const verificationRuns = pgTable(
  "verification_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: verificationSubject("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    agent: text("agent").notNull(),
    agentVersion: text("agent_version").notNull(),
    /** LLM model when the agent uses one. */
    model: text("model"),
    verdict: verificationVerdict("verdict").notNull(),
    findings: jsonb("findings").$type<VerificationFinding[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verification_runs_subject_idx").on(t.subjectType, t.subjectId),
    index("verification_runs_agent_idx").on(t.agent, t.createdAt),
  ],
);

export type VerificationFinding = {
  severity: "info" | "warning" | "error";
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
  sourceUrl?: string;
};

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
