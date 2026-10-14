import {
  benefitContentSchema,
  lintRules,
  type BenefitContent,
  type RuleGroup,
  type RuleNode,
} from "@tetoca/core";
import type { LlmBenefit, LlmGroup, LlmRule } from "./schema";

function isLlmRule(node: LlmRule | LlmGroup): node is LlmRule {
  return "field" in node;
}

function convertNode(node: LlmRule | LlmGroup, sourceUrl: string): RuleNode {
  if (!isLlmRule(node)) return convertGroup(node, sourceUrl);
  const common = {
    field: node.field,
    label: node.label,
    ...(node.hard ? { hard: true } : {}),
    source: { url: sourceUrl, excerpt: node.excerpt },
  };
  if (node.op === "exists") return { ...common, op: "exists" } as RuleNode;
  return { ...common, op: node.op, value: node.value } as RuleNode;
}

export function convertGroup(group: LlmGroup, sourceUrl: string): RuleGroup {
  const out: RuleGroup = {};
  if (group.all.length) out.all = group.all.map((n) => convertNode(n, sourceUrl));
  if (group.any.length) out.any = group.any.map((n) => convertNode(n, sourceUrl));
  if (group.label) out.label = group.label;
  if (!out.all && !out.any) out.all = [];
  return out;
}

const orUndefined = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

/** Converts the LLM output into the domain type, adding traceability. */
export function toBenefitContent(
  b: LlmBenefit,
  source: { url: string; retrievedAt: string },
): unknown {
  return {
    slug: b.slug,
    title: b.title,
    summary: b.summary,
    level: b.level,
    region: orUndefined(b.region),
    municipality: orUndefined(b.municipality),
    category: b.category,
    kind: b.kind,
    agency: orUndefined(b.agency),
    amount: {
      type: b.amount.type,
      min: orUndefined(b.amount.min),
      max: orUndefined(b.amount.max),
      text: b.amount.text,
    },
    window:
      b.window.opensAt || b.window.closesAt || b.window.text
        ? {
            opensAt: orUndefined(b.window.opensAt),
            closesAt: orUndefined(b.window.closesAt),
            text: orUndefined(b.window.text),
          }
        : undefined,
    eligibility: convertGroup(b.eligibility, source.url),
    otherRequirements: b.otherRequirements,
    documents: b.documents,
    steps: b.steps,
    officialUrl: b.officialUrl ?? source.url,
    sources: [{ url: source.url, retrievedAt: source.retrievedAt }],
    faq: b.faq,
  };
}

/** Validates converted content with the domain schema and rule linting. */
export function validateContent(
  content: unknown,
): { ok: true; content: BenefitContent } | { ok: false; errors: string[] } {
  const parsed = benefitContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const errors = lintRules(parsed.data.eligibility);
  if (parsed.data.level !== "state" && !parsed.data.region)
    errors.push("region: required for regional/municipal benefits");
  if (parsed.data.kind === "call" && !parsed.data.window) errors.push("window: required for calls");
  return errors.length ? { ok: false, errors } : { ok: true, content: parsed.data };
}

const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Rule excerpts that do not appear literally in the source text. */
export function missingExcerpts(rules: RuleGroup, sourceText: string): string[] {
  const haystack = normalise(sourceText);
  const missing: string[] = [];
  const visit = (node: RuleNode) => {
    if ("op" in node) {
      if (node.source && !haystack.includes(normalise(node.source.excerpt)))
        missing.push(node.label);
      return;
    }
    [...(node.all ?? []), ...(node.any ?? [])].forEach(visit);
  };
  visit(rules);
  return missing;
}
