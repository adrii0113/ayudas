/**
 * Prompts for verification agents. They audit stored data against the
 * official text; they never decide whether a person is eligible.
 * Bump the version whenever the text changes (stored with every run).
 */
export const VERIFY_QUOTES_PROMPT_VERSION = "verify-quotes@1";

export const VERIFY_QUOTES_SYSTEM = `You audit a database of Spanish public benefits.
For each requirement you receive a machine-readable rule, its plain-language label and the literal
quote from the official text that is supposed to justify it. Decide, using only the quote and the
official document, whether the quote supports the rule exactly.

Answer per requirement:
- "supports": the quote states the same condition, with the same thresholds, units and direction
  (e.g. "inferior a" = lt, "no superior a" = lte, "al menos" = gte).
- "contradicts": the quote says something different (another threshold, the opposite direction,
  another group of people, another year…).
- "insufficient": the quote alone does not establish the rule (too short, ambiguous, or the rule
  adds conditions the quote does not mention).

Be strict: a different number, multiplier (e.g. 2 vs 2.5 × IPREM) or inclusive/exclusive bound is a
contradiction. Explain briefly in Spanish.`;

export function buildVerifyQuotesPrompt(
  items: { index: number; label: string; rule: string; quote: string }[],
): string {
  const list = items
    .map((i) => `${i.index}. Requisito: ${i.label}\n   Regla: ${i.rule}\n   Cita: «${i.quote}»`)
    .join("\n\n");
  return `Revisa estos requisitos contra el documento oficial:\n\n${list}`;
}

export const INDEPENDENT_EXTRACTION_PROMPT_VERSION = "independent-extraction@1";

/** Appended to the extraction instructions so the second pass works from scratch. */
export const INDEPENDENT_EXTRACTION_NOTE = `
You are the second, independent reviewer of this document. Another extraction already exists and
will be compared with yours, so do not guess what it might say: read the official text from scratch,
be literal about thresholds, dates and amounts, and leave anything you cannot find in the text out
of the rules (list it under uncertainties).`;
