import type { Benefit } from "@tetoca/core";
import {
  citationsAgent,
  deadlinesAgent,
  linksAgent,
  parametersAgent,
} from "./agents/deterministic";
import { quoteCheckAgent, secondExtractionAgent } from "./agents/llm";
import { fetchSources, sourceUrlsFor } from "./runner";
import type { AgentDeps, AgentResult, Finding, VerificationAgent } from "./types";

/**
 * Publication gate for the curated catalog (owner decision 2026-10-15: no human
 * review). A benefit is shown and evaluated only if, against its official
 * sources: every rule has a literal quote found in the text (citations = pass),
 * and no deterministic agent fails (links, deadlines, parameters). When an LLM
 * is configured, the LLM agents must not fail either.
 */
export const GATE_AGENTS: VerificationAgent[] = [
  citationsAgent,
  linksAgent,
  deadlinesAgent,
  parametersAgent,
  quoteCheckAgent,
  secondExtractionAgent,
];

export type GateResult = {
  passed: boolean;
  agents: Record<string, AgentResult["verdict"]>;
  findings: (Finding & { agent: string })[];
  models: string[];
};

export function gateDecision(results: Record<string, AgentResult>): boolean {
  if (results.citations?.verdict !== "pass") return false;
  return Object.values(results).every((r) => r.verdict !== "fail");
}

export async function checkBenefit(
  benefit: Benefit,
  deps: AgentDeps,
  today: string,
): Promise<GateResult> {
  const sources = await fetchSources(sourceUrlsFor(benefit), deps.fetch);
  const subject = {
    revisionId: benefit.slug,
    benefit,
    trustLevel: "extracted" as const,
    sources,
    today,
  };
  const results: Record<string, AgentResult> = {};
  for (const agent of GATE_AGENTS) {
    if (agent.needsLlm && !deps.llm) continue;
    try {
      results[agent.name] = await agent.run(subject, deps);
    } catch (err) {
      results[agent.name] = {
        verdict: "uncertain",
        findings: [{ severity: "warning", message: `Agent error: ${(err as Error).message}` }],
      };
    }
  }
  return {
    passed: gateDecision(results),
    agents: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.verdict])),
    findings: Object.entries(results).flatMap(([agent, r]) =>
      r.findings.filter((f) => f.severity !== "info").map((f) => ({ ...f, agent })),
    ),
    models: [...new Set(Object.values(results).flatMap((r) => (r.model ? [r.model] : [])))],
  };
}

/** Days a previous pass is kept while the official sources cannot be read. */
export const GRACE_DAYS = 14;

/**
 * A failure that may come from not being able to read the sources (network
 * blocks, bot walls, sites unreachable from the CI region) rather than from a
 * real change: nothing failed except quote checks.
 */
export function isReadFailure(agents: Record<string, string>): boolean {
  const hard = ["links", "deadlines", "parameters", "quote-check", "second-extraction"];
  return hard.every((a) => agents[a] !== "fail") && agents.citations !== "pass";
}

/**
 * Keeps a recent pass for the same content when the new attempt only failed
 * to read the sources; real failures (broken link, closed deadline, edited
 * content) or read failures beyond GRACE_DAYS replace it.
 */
export function withGrace<
  T extends {
    passed: boolean;
    contentHash: string;
    checkedAt: string;
    agents: Record<string, string>;
  },
>(previous: T | undefined, next: T, today: string): T {
  if (next.passed || !previous?.passed || previous.contentHash !== next.contentHash) return next;
  if (!isReadFailure(next.agents)) return next;
  const age = (Date.parse(today) - Date.parse(previous.checkedAt)) / 86_400_000;
  if (age > GRACE_DAYS) return next;
  return { ...previous, lastFailedAttempt: { checkedAt: next.checkedAt, agents: next.agents } };
}
