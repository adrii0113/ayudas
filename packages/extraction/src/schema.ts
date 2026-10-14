import {
  BENEFIT_CATEGORIES,
  BENEFIT_KINDS,
  BENEFIT_LEVELS,
  COMPARISON_OPS,
  CONSTANT_KEYS,
  DERIVED_FIELDS,
  PROFILE_FIELDS,
} from "@tetoca/core";
import { z } from "zod";

/**
 * LLM-facing schema. Structured outputs do not support recursive schemas, so
 * rule groups and value expressions are unrolled to a fixed depth. The result
 * is converted to the core types and validated again with the real schemas.
 */
const RULE_FIELDS = [...PROFILE_FIELDS, ...DERIVED_FIELDS] as unknown as [string, ...string[]];
const REFS = [...CONSTANT_KEYS, ...RULE_FIELDS] as [string, ...string[]];

function exprSchema(depth: number): z.ZodType {
  const base = [z.number(), z.object({ ref: z.enum(REFS) })] as const;
  if (depth === 0) return z.union(base);
  const inner = z.array(exprSchema(depth - 1));
  return z.union([
    ...base,
    z.object({ add: inner }),
    z.object({ mul: inner }),
    z.object({ min: inner }),
  ]);
}

export const llmRuleSchema = z.object({
  field: z.enum(RULE_FIELDS),
  op: z.enum([...COMPARISON_OPS, "exists"]),
  value: z
    .union([z.string(), z.boolean(), z.array(z.union([z.string(), z.number()])), exprSchema(3)])
    .nullable(),
  label: z.string(),
  hard: z.boolean(),
  excerpt: z.string(),
});

function groupSchema(depth: number): z.ZodType {
  const item = depth === 1 ? llmRuleSchema : z.union([llmRuleSchema, groupSchema(depth - 1)]);
  return z.object({
    all: z.array(item),
    any: z.array(item),
    label: z.string().nullable(),
  });
}

export const llmBenefitSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  level: z.enum(BENEFIT_LEVELS),
  region: z.string().nullable(),
  municipality: z.string().nullable(),
  category: z.enum(BENEFIT_CATEGORIES),
  kind: z.enum(BENEFIT_KINDS),
  agency: z.string().nullable(),
  amount: z.object({
    type: z.enum(["fixed", "range", "percent", "variable"]),
    min: z.number().nullable(),
    max: z.number().nullable(),
    text: z.string(),
  }),
  window: z.object({
    opensAt: z.string().nullable(),
    closesAt: z.string().nullable(),
    text: z.string().nullable(),
  }),
  eligibility: groupSchema(3),
  otherRequirements: z.array(z.string()),
  documents: z.array(z.string()),
  steps: z.array(z.string()),
  officialUrl: z.string().nullable(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export const llmExtractionSchema = z.object({
  isHouseholdBenefit: z.boolean(),
  benefit: llmBenefitSchema.nullable(),
  uncertainties: z.array(z.string()),
});

export type LlmRule = z.infer<typeof llmRuleSchema>;
export type LlmGroup = {
  all: (LlmRule | LlmGroup)[];
  any: (LlmRule | LlmGroup)[];
  label: string | null;
};
export type LlmBenefit = Omit<z.infer<typeof llmBenefitSchema>, "eligibility"> & {
  eligibility: LlmGroup;
};
export type LlmExtraction = {
  isHouseholdBenefit: boolean;
  benefit: LlmBenefit | null;
  uncertainties: string[];
};
