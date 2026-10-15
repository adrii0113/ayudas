import type { BenefitContent, RuleGroup } from "@tetoca/core";
import {
  llmExtractionSchema,
  toBenefitContent,
  validateContent,
  type LlmExtraction,
} from "@tetoca/extraction";
import {
  buildExtractBenefitPrompt,
  buildVerifyQuotesPrompt,
  EXTRACT_BENEFIT_SYSTEM,
  INDEPENDENT_EXTRACTION_NOTE,
  VERIFY_QUOTES_SYSTEM,
} from "@tetoca/llm";
import { z } from "zod";
import { leaves } from "../rules";
import { fromFindings, skipped, type Finding, type VerificationAgent } from "../types";

const quoteCheckSchema = z.object({
  checks: z.array(
    z.object({
      index: z.number().int(),
      verdict: z.enum(["supports", "contradicts", "insufficient"]),
      explanation: z.string(),
    }),
  ),
});

/** Does each quote really justify its rule (threshold, direction, scope)? */
export const quoteCheckAgent: VerificationAgent = {
  name: "quote-check",
  version: "1",
  needsLlm: true,
  async run(subject, { llm }) {
    if (!llm) return skipped("No LLM configured");
    const items = leaves(subject.benefit.eligibility)
      .filter(({ rule }) => rule.source?.excerpt)
      .map(({ path, rule }, index) => ({
        index,
        path,
        label: rule.label,
        rule: JSON.stringify({
          field: rule.field,
          op: rule.op,
          value: "value" in rule ? rule.value : undefined,
        }),
        quote: rule.source!.excerpt,
      }));
    if (!items.length) return skipped("No quoted rules");
    const source = subject.sources[0];
    const response = await llm.extract({
      system: VERIFY_QUOTES_SYSTEM,
      document: source ? { title: subject.benefit.title, text: source.text } : undefined,
      prompt: buildVerifyQuotesPrompt(items),
      schema: quoteCheckSchema,
    });
    if (!response.output) {
      return {
        verdict: "uncertain",
        model: response.model,
        findings: [
          { severity: "warning", message: `No answer from the model (${response.failure})` },
        ],
      };
    }
    const findings: Finding[] = [];
    for (const item of items) {
      const check = response.output.checks.find((c) => c.index === item.index);
      if (!check) {
        findings.push({
          severity: "warning",
          field: item.path,
          message: `"${item.label}" not checked`,
        });
      } else if (check.verdict !== "supports") {
        findings.push({
          severity: check.verdict === "contradicts" ? "error" : "warning",
          field: item.path,
          message: `"${item.label}": ${check.explanation}`,
          actual: item.quote,
        });
      }
    }
    return fromFindings(findings, response.model);
  },
};

type RuleKey = string;

/** Comparable signature of each rule (field, operator and value). */
export function ruleSignatures(group: RuleGroup): Map<RuleKey, string> {
  const out = new Map<RuleKey, string>();
  for (const { rule } of leaves(group)) {
    const value = "value" in rule ? JSON.stringify(rule.value) : "";
    out.set(`${rule.field} ${rule.op} ${value}`, rule.label);
  }
  return out;
}

/** Field-by-field differences between two extractions of the same document. */
export function compareContents(ours: BenefitContent, theirs: BenefitContent): Finding[] {
  const findings: Finding[] = [];
  const numbers: [string, number | undefined, number | undefined][] = [
    ["amount.min", ours.amount.min, theirs.amount.min],
    ["amount.max", ours.amount.max, theirs.amount.max],
  ];
  for (const [field, a, b] of numbers) {
    if (a !== undefined && b !== undefined && a !== b) {
      findings.push({
        severity: "error",
        field,
        message: "Amount differs",
        expected: b,
        actual: a,
      });
    }
  }
  for (const key of ["opensAt", "closesAt"] as const) {
    const a = ours.window?.[key]?.slice(0, 10);
    const b = theirs.window?.[key]?.slice(0, 10);
    if (a && b && a !== b) {
      findings.push({
        severity: "error",
        field: `window.${key}`,
        message: "Date differs",
        expected: b,
        actual: a,
      });
    }
  }
  const mine = ruleSignatures(ours.eligibility);
  const other = ruleSignatures(theirs.eligibility);
  for (const [sig, label] of mine) {
    if (!other.has(sig)) {
      findings.push({
        severity: "warning",
        field: "eligibility",
        message: `Only in the stored version: "${label}"`,
        actual: sig,
      });
    }
  }
  for (const [sig, label] of other) {
    if (!mine.has(sig)) {
      findings.push({
        severity: "warning",
        field: "eligibility",
        message: `Only in the independent extraction: "${label}"`,
        expected: sig,
      });
    }
  }
  return findings;
}

/** Re-extracts the document from scratch and compares it with the stored revision. */
export const secondExtractionAgent: VerificationAgent = {
  name: "second-extraction",
  version: "1",
  needsLlm: true,
  async run(subject, { llm }) {
    if (!llm) return skipped("No LLM configured");
    const source = subject.sources[0];
    if (!source) return skipped("No official text to re-extract from");
    const response = await llm.extract({
      system: EXTRACT_BENEFIT_SYSTEM + INDEPENDENT_EXTRACTION_NOTE,
      document: { title: subject.benefit.title, text: source.text },
      prompt: buildExtractBenefitPrompt({ sourceUrl: source.url }),
      schema: llmExtractionSchema,
    });
    const extraction = response.output as LlmExtraction | null;
    if (!extraction?.benefit) {
      return {
        verdict: "uncertain",
        model: response.model,
        findings: [
          {
            severity: "warning",
            message: extraction
              ? "The independent extraction did not find a benefit for households"
              : `No answer from the model (${response.failure})`,
          },
        ],
      };
    }
    const validated = validateContent(
      toBenefitContent(extraction.benefit, { url: source.url, retrievedAt: subject.today }),
    );
    if (!validated.ok) {
      return {
        verdict: "uncertain",
        model: response.model,
        findings: validated.errors.map((e) => ({
          severity: "warning" as const,
          message: `Independent extraction invalid: ${e}`,
        })),
      };
    }
    return fromFindings(compareContents(subject.benefit, validated.content), response.model);
  },
};
