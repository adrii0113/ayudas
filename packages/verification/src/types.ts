import type { Benefit, TrustLevel } from "@tetoca/core";
import type { LlmProvider } from "@tetoca/llm";

/**
 * Verification agents check that a stored record matches the official
 * sources. They never decide whether a user is eligible.
 */

export type Verdict = "pass" | "fail" | "uncertain" | "skipped";

export type Finding = {
  severity: "info" | "warning" | "error";
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
  sourceUrl?: string;
};

export type SourceText = {
  url: string;
  text: string;
  /** Stored document id when the text comes from source_documents. */
  documentId?: string;
};

/** Everything an agent may look at for one revision. */
export type RevisionSubject = {
  revisionId: string;
  benefit: Benefit;
  trustLevel: TrustLevel;
  /** Official metadata of the edition (e.g. the BDNS record), when known. */
  edition?: {
    bdnsCode: string | null;
    opensAt: string | null;
    closesAt: string | null;
    officialUrl: string | null;
    territoryIds: string[];
    hasSourceMetadata: boolean;
  };
  /** Official texts the revision is based on (stored or fetched). */
  sources: SourceText[];
  today: string;
};

export type AgentResult = {
  verdict: Verdict;
  findings: Finding[];
  /** LLM model used, if any. */
  model?: string;
};

export type AgentDeps = {
  llm?: LlmProvider;
  fetch?: typeof fetch;
};

export interface VerificationAgent {
  readonly name: string;
  /** Bump when the agent's logic or prompt changes (stored with every run). */
  readonly version: string;
  /** Agents that need an LLM are skipped when none is configured. */
  readonly needsLlm?: boolean;
  run(subject: RevisionSubject, deps: AgentDeps): Promise<AgentResult>;
}

export const pass = (findings: Finding[] = []): AgentResult => ({ verdict: "pass", findings });
export const skipped = (message: string): AgentResult => ({
  verdict: "skipped",
  findings: [{ severity: "info", message }],
});
/** fail if any error, uncertain if any warning, otherwise pass. */
export function fromFindings(findings: Finding[], model?: string): AgentResult {
  const verdict: Verdict = findings.some((f) => f.severity === "error")
    ? "fail"
    : findings.some((f) => f.severity === "warning")
      ? "uncertain"
      : "pass";
  return { verdict, findings, model };
}
