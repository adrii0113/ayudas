CREATE TYPE "public"."admin_level" AS ENUM('state', 'regional', 'provincial', 'municipal', 'other');--> statement-breakpoint
CREATE TYPE "public"."edition_status" AS ENUM('announced', 'open', 'closed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."program_type" AS ENUM('cash_benefit', 'tax_deduction', 'grant_call', 'social_tariff', 'service', 'prize', 'other');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('permanent', 'annual', 'one_off', 'irregular', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."territory_level" AS ENUM('country', 'region', 'province', 'municipality');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('detected', 'extracted', 'agent_verified', 'human_verified');--> statement-breakpoint
CREATE TYPE "public"."verification_subject" AS ENUM('program', 'edition', 'revision');--> statement-breakpoint
CREATE TYPE "public"."verification_verdict" AS ENUM('pass', 'fail', 'uncertain', 'skipped');--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"period" text,
	"title" text NOT NULL,
	"bdns_code" text,
	"status" "edition_status" DEFAULT 'unknown' NOT NULL,
	"opens_at" date,
	"closes_at" date,
	"window_text" text,
	"budget_total" numeric(16, 2),
	"official_url" text,
	"regulatory_bases_url" text,
	"beneficiary_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"territory_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_metadata" jsonb,
	"source_hash" text,
	"published_at" date,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_id" uuid NOT NULL,
	"target" text NOT NULL,
	"document_id" uuid,
	"url" text,
	"quote" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_level" "admin_level" NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"parent_name" text,
	"territory_id" text,
	"dir3_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameters" (
	"key" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"value" numeric(14, 2) NOT NULL,
	"unit" text NOT NULL,
	"source_label" text NOT NULL,
	"source_url" text,
	CONSTRAINT "parameters_key_valid_from_pk" PRIMARY KEY("key","valid_from")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"type" "program_type" NOT NULL,
	"category" text,
	"beneficiary_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"admin_level" "admin_level" NOT NULL,
	"territory_id" text NOT NULL,
	"organism_id" uuid,
	"recurrence" "recurrence" DEFAULT 'unknown' NOT NULL,
	"trust_level" "trust_level" DEFAULT 'detected' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" text PRIMARY KEY NOT NULL,
	"level" "territory_level" NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"ine_code" text,
	"iso_code" text,
	"nuts_codes" text[],
	"fiscal_regime" text
);
--> statement-breakpoint
CREATE TABLE "verification_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "verification_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"agent" text NOT NULL,
	"agent_version" text NOT NULL,
	"model" text,
	"verdict" "verification_verdict" NOT NULL,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "benefits" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "benefits" ADD COLUMN "edition_id" uuid;--> statement-breakpoint
ALTER TABLE "benefits" ADD COLUMN "trust_level" "trust_level" DEFAULT 'extracted' NOT NULL;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_document_id_source_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisms" ADD CONSTRAINT "organisms_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_organism_id_organisms_id_fk" FOREIGN KEY ("organism_id") REFERENCES "public"."organisms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "editions_bdns_idx" ON "editions" USING btree ("bdns_code");--> statement-breakpoint
CREATE INDEX "editions_program_idx" ON "editions" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "editions_closes_at_idx" ON "editions" USING btree ("closes_at");--> statement-breakpoint
CREATE INDEX "editions_status_idx" ON "editions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evidence_benefit_idx" ON "evidence" USING btree ("benefit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organisms_source_key_idx" ON "organisms" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "organisms_territory_idx" ON "organisms" USING btree ("territory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_idx" ON "programs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "programs_territory_idx" ON "programs" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "programs_trust_idx" ON "programs" USING btree ("trust_level");--> statement-breakpoint
CREATE INDEX "programs_type_idx" ON "programs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "territories_parent_idx" ON "territories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "territories_name_idx" ON "territories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "verification_runs_subject_idx" ON "verification_runs" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "verification_runs_agent_idx" ON "verification_runs" USING btree ("agent","created_at");--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "benefits_program_idx" ON "benefits" USING btree ("program_id");