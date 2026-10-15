import type { Rule, RuleGroup } from "@tetoca/core";

export type Leaf = Rule;

/** Leaf rules with their path in the tree ("all.0", "all.1.any.0"…). */
export function leaves(group: RuleGroup, prefix = ""): { path: string; rule: Leaf }[] {
  const out: { path: string; rule: Leaf }[] = [];
  for (const key of ["all", "any"] as const) {
    group[key]?.forEach((node, i) => {
      const path = `${prefix}${key}.${i}`;
      if ("op" in node) out.push({ path, rule: node as Leaf });
      else out.push(...leaves(node, `${path}.`));
    });
  }
  return out;
}

export const normalizeText = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    // Removing HTML tags leaves spaces before punctuation ("general , por").
    .replace(/ ([,.;:)\]])/g, "$1")
    .replace(/([([¿¡]) /g, "$1")
    .trim()
    .toLowerCase();

/** "[...]" or "[…]" marks an omitted passage inside a quote. */
const ELLIPSIS = /\s*\[(?:\.\.\.|…)\]\s*/;

/**
 * Where a quote appears in a text (on the normalised text), tolerant only to
 * whitespace, quote styles and "[...]" omissions, whose parts must appear in
 * order. Paraphrases are not found, on purpose.
 */
export function findQuote(text: string, quote: string): { start: number; end: number } | undefined {
  const haystack = normalizeText(text);
  const parts = quote.split(ELLIPSIS).map(normalizeText).filter(Boolean);
  if (!parts.length) return undefined;
  let from = 0;
  let start = -1;
  for (const part of parts) {
    const at = haystack.indexOf(part, from);
    if (at < 0) return undefined;
    if (start < 0) start = at;
    from = at + part.length;
  }
  return { start, end: from };
}

export function locateQuote(text: string, quote: string): number {
  return findQuote(text, quote)?.start ?? -1;
}
