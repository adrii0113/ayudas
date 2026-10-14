import { z } from "zod";
import { CONSTANT_KEYS } from "../config/types";
import { PROFILE_FIELDS } from "../profile";
import {
  COMPARISON_OPS,
  DERIVED_FIELDS,
  type RuleField,
  type RuleGroup,
  type RuleNode,
  type ValueExpr,
} from "./types";

const RULE_FIELDS = [...PROFILE_FIELDS, ...DERIVED_FIELDS] as unknown as [
  RuleField,
  ...RuleField[],
];

export const ruleFieldSchema = z.enum(RULE_FIELDS);

export const valueExprSchema: z.ZodType<ValueExpr> = z.lazy(() =>
  z.union([
    z.number(),
    z.object({ ref: z.enum([...CONSTANT_KEYS, ...RULE_FIELDS]) }).strict(),
    z.object({ add: z.array(valueExprSchema).min(1) }).strict(),
    z.object({ mul: z.array(valueExprSchema).min(1) }).strict(),
    z.object({ min: z.array(valueExprSchema).min(1) }).strict(),
  ]),
) as z.ZodType<ValueExpr>;

const ruleSourceSchema = z.object({
  url: z.string().url().optional(),
  excerpt: z.string().min(1),
});

const ruleValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
  valueExprSchema,
]);

const comparisonRuleSchema = z
  .object({
    field: ruleFieldSchema,
    op: z.enum(COMPARISON_OPS),
    value: ruleValueSchema,
    label: z.string().min(1),
    hard: z.boolean().optional(),
    source: ruleSourceSchema.optional(),
  })
  .strict();

const existsRuleSchema = z
  .object({
    op: z.literal("exists"),
    field: ruleFieldSchema,
    label: z.string().min(1),
    hard: z.boolean().optional(),
    source: ruleSourceSchema.optional(),
  })
  .strict();

export const ruleGroupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z
    .object({
      all: z.array(ruleNodeSchema).optional(),
      any: z.array(ruleNodeSchema).min(1).optional(),
      label: z.string().optional(),
      hard: z.boolean().optional(),
    })
    .strict()
    .refine((g) => g.all !== undefined || g.any !== undefined, {
      message: "A rule group needs `all` or `any`",
    }),
) as z.ZodType<RuleGroup>;

export const ruleNodeSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.union([comparisonRuleSchema, existsRuleSchema, ruleGroupSchema]),
) as z.ZodType<RuleNode>;
