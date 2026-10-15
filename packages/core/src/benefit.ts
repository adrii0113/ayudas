import { z } from "zod";
import { PROGRAM_TYPES } from "./program";
import { ruleGroupSchema } from "./rules/schema";

export const BENEFIT_LEVELS = ["state", "regional", "municipal"] as const;
export const BENEFIT_CATEGORIES = [
  "birth",
  "housing",
  "energy",
  "income",
  "education",
  "dependency",
  "employment",
] as const;
export const BENEFIT_KINDS = ["permanent", "call"] as const;
export const BENEFIT_STATUSES = ["draft", "published", "archived"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected an ISO date (YYYY-MM-DD)");

export const amountSchema = z.object({
  type: z.enum(["fixed", "range", "percent", "variable"]),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Plain-language amount, e.g. "Hasta 250 € al mes". */
  text: z.string().min(1),
});

export const sourceSchema = z.object({
  url: z.string().url(),
  retrievedAt: isoDate,
  excerpt: z.string().optional(),
});

/** Fields describing a benefit, without lifecycle metadata (what the LLM extracts). */
export const benefitContentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be kebab-case"),
  title: z.string().min(3),
  /** Plain language, max. 2 sentences. */
  summary: z.string().min(10).max(400),
  level: z.enum(BENEFIT_LEVELS),
  region: z.string().optional(),
  municipality: z.string().optional(),
  category: z.enum(BENEFIT_CATEGORIES),
  kind: z.enum(BENEFIT_KINDS),
  /** Registry program type; derived from slug/kind when omitted (see deriveProgramType). */
  programType: z.enum(PROGRAM_TYPES).optional(),
  /** Organisation that manages it, e.g. "Seguridad Social". */
  agency: z.string().optional(),
  amount: amountSchema,
  window: z
    .object({
      opensAt: isoDate.optional(),
      closesAt: isoDate.optional(),
      /** Plain-language deadline when there are no exact dates. */
      text: z.string().optional(),
    })
    .optional(),
  eligibility: ruleGroupSchema,
  /** Extra conditions the engine does not check (shown as "also required"). */
  otherRequirements: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
  officialUrl: z.string().url(),
  sources: z.array(sourceSchema).min(1),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

export const benefitSchema = benefitContentSchema
  .extend({
    id: z.string().min(1),
    status: z.enum(BENEFIT_STATUSES),
    version: z.number().int().min(1),
    reviewedBy: z.string().optional(),
    /** Date the automatic verification gate last passed (YYYY-MM-DD). */
    verifiedAt: z.string().optional(),
    reviewedAt: isoDate.optional(),
  })
  .superRefine((b, ctx) => {
    if (b.level !== "state" && !b.region) {
      ctx.addIssue({ code: "custom", message: "Regional/municipal benefits need `region`" });
    }
    if (b.level === "municipal" && !b.municipality) {
      ctx.addIssue({ code: "custom", message: "Municipal benefits need `municipality`" });
    }
    if (b.status === "published" && (!b.reviewedBy || !b.reviewedAt)) {
      ctx.addIssue({
        code: "custom",
        message: "Published benefits need `reviewedBy` and `reviewedAt` (human review)",
      });
    }
    if (b.kind === "call" && !b.window) {
      ctx.addIssue({ code: "custom", message: "Calls (`kind: call`) need a `window`" });
    }
  });

export type BenefitContent = z.infer<typeof benefitContentSchema>;
export type Benefit = z.infer<typeof benefitSchema>;
export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number];
export type BenefitLevel = (typeof BENEFIT_LEVELS)[number];

/** `reviewedBy` prefix used when an AI assistant curated a benefit that still needs a person. */
export const PENDING_HUMAN_REVIEW_PREFIX = "claude";

export function needsHumanReview(benefit: Pick<Benefit, "reviewedBy">): boolean {
  return benefit.reviewedBy?.toLowerCase().startsWith(PENDING_HUMAN_REVIEW_PREFIX) ?? false;
}
