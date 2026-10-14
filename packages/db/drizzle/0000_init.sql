CREATE TYPE "public"."benefit_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('succeeded', 'invalid_output', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('bdns', 'bocyl', 'boe', 'municipal', 'manual');--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"benefit_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text,
	"email_hash" text NOT NULL,
	"email_encrypted" text NOT NULL,
	"profile_encrypted" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"confirm_token_hash" text,
	"confirmed_at" timestamp with time zone,
	"manage_token_hash" text NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"status" "benefit_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"level" text NOT NULL,
	"region" text,
	"opens_at" date,
	"closes_at" date,
	"source_document_id" uuid,
	"extraction_id" uuid,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"status" "extraction_status" NOT NULL,
	"output" jsonb,
	"uncertainties" jsonb,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source_kind" NOT NULL,
	"external_id" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"content_hash" text NOT NULL,
	"mime_type" text,
	"needs_manual_review" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_subscription_id_alert_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."alert_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_extraction_id_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."extractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_document_id_source_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_deliveries_unique_idx" ON "alert_deliveries" USING btree ("subscription_id","benefit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_subscriptions_email_idx" ON "alert_subscriptions" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "benefits_slug_version_idx" ON "benefits" USING btree ("slug","version");--> statement-breakpoint
CREATE UNIQUE INDEX "benefits_one_published_idx" ON "benefits" USING btree ("slug") WHERE "benefits"."status" = 'published';--> statement-breakpoint
CREATE INDEX "benefits_status_idx" ON "benefits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "benefits_closes_at_idx" ON "benefits" USING btree ("closes_at");--> statement-breakpoint
CREATE INDEX "extractions_cache_idx" ON "extractions" USING btree ("input_hash","prompt_version");--> statement-breakpoint
CREATE UNIQUE INDEX "source_documents_hash_idx" ON "source_documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "source_documents_external_idx" ON "source_documents" USING btree ("source","external_id");