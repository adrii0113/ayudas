import { todayInSpain } from "@tetoca/core";
import {
  getRevisionForVerification,
  recordVerificationRun,
  replaceEvidence,
  rowToBenefit,
  saveSourceDocument,
  setRevisionTrust,
  type Database,
} from "@tetoca/db";
import {
  citationsAgent,
  deadlinesAgent,
  linksAgent,
  parametersAgent,
  sourceConsistencyAgent,
} from "./agents/deterministic";
import { quoteCheckAgent, secondExtractionAgent } from "./agents/llm";
import { decide, type Decision } from "./aggregate";
import { findQuote, leaves } from "./rules";
import { fetchSourceText, sha256 } from "./sources";
import type {
  AgentDeps,
  AgentResult,
  RevisionSubject,
  SourceText,
  VerificationAgent,
} from "./types";

export const DEFAULT_AGENTS: VerificationAgent[] = [
  citationsAgent,
  sourceConsistencyAgent,
  parametersAgent,
  deadlinesAgent,
  linksAgent,
  quoteCheckAgent,
  secondExtractionAgent,
];

export type VerificationReport = {
  revisionId: string;
  results: Record<string, AgentResult>;
  decision: Decision;
};

/**
 * Official texts for a revision: its stored source document, or else the
 * pages/PDFs it cites, downloaded and archived in source_documents so every
 * check can be audited later.
 */
async function collectSources(
  db: Database,
  data: NonNullable<Awaited<ReturnType<typeof getRevisionForVerification>>>,
  deps: AgentDeps,
): Promise<SourceText[]> {
  if (data.document && !data.document.needsManualReview) {
    return [{ url: data.document.url, text: data.document.text, documentId: data.document.id }];
  }
  // General sources plus the page each rule cites (they are often different).
  const urls = [
    ...new Set([
      ...data.row.content.sources.map((s) => s.url),
      ...leaves(data.row.content.eligibility).flatMap(({ rule }) =>
        rule.source?.url ? [rule.source.url] : [],
      ),
    ]),
  ];
  const out: SourceText[] = [];
  for (const url of urls) {
    try {
      const fetched = await fetchSourceText(url, deps.fetch);
      if (!fetched?.text.trim()) continue;
      const { document } = await saveSourceDocument(db, {
        source: "manual",
        url,
        title: fetched.title,
        text: fetched.text,
        contentHash: sha256(fetched.text),
        mimeType: fetched.mimeType,
      });
      out.push({ url, text: fetched.text, documentId: document.id });
    } catch {
      // Unreachable sources are reported by the links agent.
    }
  }
  return out;
}

export async function verifyRevision(
  db: Database,
  revisionId: string,
  deps: AgentDeps = {},
  options: { agents?: VerificationAgent[]; today?: string } = {},
): Promise<VerificationReport> {
  const data = await getRevisionForVerification(db, revisionId);
  if (!data) throw new Error(`Revision ${revisionId} not found`);
  const today = options.today ?? todayInSpain();
  const subject: RevisionSubject = {
    revisionId,
    benefit: rowToBenefit(data.row),
    trustLevel: data.row.trustLevel,
    edition: data.edition
      ? {
          bdnsCode: data.edition.bdnsCode,
          opensAt: data.edition.opensAt,
          closesAt: data.edition.closesAt,
          officialUrl: data.edition.officialUrl,
          territoryIds: data.edition.territoryIds,
          hasSourceMetadata: !!data.edition.sourceMetadata,
        }
      : undefined,
    sources: await collectSources(db, data, deps),
    today,
  };

  const results: Record<string, AgentResult> = {};
  for (const agent of options.agents ?? DEFAULT_AGENTS) {
    let result: AgentResult;
    if (agent.needsLlm && !deps.llm) {
      result = {
        verdict: "skipped",
        findings: [{ severity: "info", message: "No LLM configured" }],
      };
    } else {
      try {
        result = await agent.run(subject, deps);
      } catch (err) {
        result = {
          verdict: "uncertain",
          findings: [{ severity: "warning", message: `Agent error: ${(err as Error).message}` }],
        };
      }
    }
    results[agent.name] = result;
    await recordVerificationRun(db, {
      subjectType: "revision",
      subjectId: revisionId,
      agent: agent.name,
      agentVersion: agent.version,
      model: result.model,
      verdict: result.verdict,
      findings: result.findings,
    });
  }

  // Located quotes become evidence rows (the trail behind every rule).
  const evidenceRows = leaves(subject.benefit.eligibility).flatMap(({ path, rule }) => {
    const quote = rule.source?.excerpt;
    if (!quote) return [];
    const match = subject.sources
      .map((s) => ({ source: s, at: findQuote(s.text, quote) }))
      .find((m) => m.at);
    return [
      {
        target: path,
        documentId: match?.source.documentId ?? null,
        url: match?.source.url ?? rule.source?.url ?? null,
        quote,
        // Offsets refer to the normalised text (see normalizeText).
        startOffset: match?.at?.start ?? null,
        endOffset: match?.at?.end ?? null,
        verified: !!match,
      },
    ];
  });
  await replaceEvidence(db, revisionId, evidenceRows);

  const decision = decide(
    subject.trustLevel,
    Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.verdict])),
  );
  if (decision.trustLevel !== subject.trustLevel) {
    await setRevisionTrust(db, revisionId, decision.trustLevel);
  }
  return { revisionId, results, decision };
}
