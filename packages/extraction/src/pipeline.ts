import type { BenefitContent } from "@tetoca/core";
import {
  findCachedExtraction,
  getSourceDocument,
  saveDraft,
  saveExtraction,
  type Database,
} from "@tetoca/db";
import {
  buildExtractBenefitPrompt,
  EXTRACT_BENEFIT_PROMPT_VERSION,
  EXTRACT_BENEFIT_SYSTEM,
  type LlmProvider,
} from "@tetoca/llm";
import { missingExcerpts, toBenefitContent, validateContent } from "./convert";
import { llmExtractionSchema, type LlmExtraction } from "./schema";

export type ExtractionOutcome =
  | { status: "draft_created"; extractionId: string; benefitId: string; uncertainties: string[] }
  | { status: "not_a_household_benefit"; extractionId: string; uncertainties: string[] }
  | { status: "cached"; extractionId: string }
  | { status: "needs_manual_review"; extractionId?: string; reason: string };

type Attempt =
  | { ok: true; content: BenefitContent | null; extraction: LlmExtraction }
  | { ok: false; errors: string[]; extraction?: LlmExtraction };

const MAX_ATTEMPTS = 2;

/**
 * Runs the LLM over a stored source document and saves the result as a
 * *draft* benefit. Nothing is ever published automatically: an admin reviews
 * every draft. Results are cached by document hash + prompt version.
 */
export async function extractDocument(options: {
  db: Database;
  llm: LlmProvider;
  documentId: string;
  /** Re-run even if a cached extraction exists. */
  force?: boolean;
}): Promise<ExtractionOutcome> {
  const { db, llm, documentId } = options;
  const doc = await getSourceDocument(db, documentId);
  if (!doc) throw new Error(`Source document ${documentId} not found`);
  if (doc.needsManualReview) {
    return {
      status: "needs_manual_review",
      reason: "Source text could not be read (scanned PDF?)",
    };
  }

  if (!options.force) {
    const cached = await findCachedExtraction(db, doc.contentHash, EXTRACT_BENEFIT_PROMPT_VERSION);
    if (cached) return { status: "cached", extractionId: cached.id };
  }

  const source = { url: doc.url, retrievedAt: doc.retrievedAt.toISOString().slice(0, 10) };
  let feedback: string | undefined;
  let last: Attempt | undefined;
  let model = "";
  let attempts = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    const response = await llm.extract({
      system: EXTRACT_BENEFIT_SYSTEM,
      document: { title: doc.title, text: doc.text },
      prompt: buildExtractBenefitPrompt({ sourceUrl: doc.url, feedback }),
      schema: llmExtractionSchema,
    });
    model = response.model;
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;

    const extraction = response.output as LlmExtraction | null;
    if (!extraction) {
      last = { ok: false, errors: [`No structured output (${response.failure ?? "unknown"})`] };
      if (response.failure === "refusal") break;
    } else if (!extraction.isHouseholdBenefit || !extraction.benefit) {
      last = { ok: true, content: null, extraction };
      break;
    } else {
      const validated = validateContent(toBenefitContent(extraction.benefit, source));
      last = validated.ok
        ? { ok: true, content: validated.content, extraction }
        : { ok: false, errors: validated.errors, extraction };
      if (validated.ok) break;
    }
    feedback = last.ok ? undefined : last.errors.map((e) => `- ${e}`).join("\n");
  }

  const result = last!;
  const uncertainties = [...(result.extraction?.uncertainties ?? [])];
  if (result.ok && result.content) {
    for (const label of missingExcerpts(result.content.eligibility, doc.text)) {
      uncertainties.push(
        `La cita del requisito "${label}" no aparece literalmente en el texto fuente.`,
      );
    }
  }

  const saved = await saveExtraction(db, {
    documentId: doc.id,
    inputHash: doc.contentHash,
    promptVersion: EXTRACT_BENEFIT_PROMPT_VERSION,
    model,
    status: result.ok ? "succeeded" : "invalid_output",
    output: result.extraction ?? null,
    uncertainties,
    error: result.ok ? null : result.errors.join("\n"),
    attempts,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });

  if (!result.ok) {
    return {
      status: "needs_manual_review",
      extractionId: saved.id,
      reason: result.errors.join("; "),
    };
  }
  if (!result.content) {
    return { status: "not_a_household_benefit", extractionId: saved.id, uncertainties };
  }
  const benefitId = await saveDraft(db, result.content, {
    sourceDocumentId: doc.id,
    extractionId: saved.id,
  });
  return { status: "draft_created", extractionId: saved.id, benefitId, uncertainties };
}
