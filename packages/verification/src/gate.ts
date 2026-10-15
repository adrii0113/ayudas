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
