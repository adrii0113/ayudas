import type { Benefit } from "@tetoca/core";
import {
  linkBenefitToRegistry,
  listEvidence,
  listVerificationRuns,
  getProgramBySlug,
  upsertSeedBenefit,
  listPublishedBenefits,
} from "@tetoca/db";
import { createTestDb } from "@tetoca/db/testing";
import type { LlmBenefit } from "@tetoca/extraction";
import { VERIFY_QUOTES_SYSTEM, type LlmProvider } from "@tetoca/llm";
import { describe, expect, it } from "vitest";
import {
  citationsAgent,
  compareContents,
  findQuote,
  deadlinesAgent,
  decide,
  linksAgent,
  verifyRevision,
  type RevisionSubject,
} from "../src";

const OFFICIAL_URL = "https://sede.example.org/bono";
const OFFICIAL_HTML = `<html><head><title>Bono Nacimiento</title></head><body>
<p>Podrán ser beneficiarias las personas mayores de edad empadronadas en la comunidad.</p>
<p>La renta de la unidad familiar no podrá superar 40.000 euros.</p>
<p>Plazo: del 1 de enero al 31 de diciembre de 2026.</p></body></html>`;

const benefit: Benefit = {
  id: "bono-test",
  slug: "bono-test",
  title: "Bono Nacimiento de prueba",
  summary: "Ayuda de prueba por nacimiento para los tests de verificación.",
  level: "state",
  category: "birth",
  kind: "call",
  amount: { type: "fixed", min: 1000, text: "1.000 €" },
  window: { opensAt: "2026-01-01", closesAt: "2026-12-31" },
  eligibility: {
    all: [
      {
        field: "applicantAge",
        op: "gte",
        value: 18,
        label: "Mayor de edad",
        source: { url: OFFICIAL_URL, excerpt: "las personas mayores de edad" },
      },
      {
        field: "annualHouseholdIncome",
        op: "lte",
        value: 40000,
        label: "Renta máxima de 40.000 €",
        source: {
          url: OFFICIAL_URL,
          excerpt: "La renta de la unidad familiar no podrá superar 40.000 euros",
        },
      },
    ],
  },
  otherRequirements: [],
  documents: [],
  steps: [],
  officialUrl: OFFICIAL_URL,
  sources: [{ url: OFFICIAL_URL, retrievedAt: "2026-10-01" }],
  faq: [],
  status: "published",
  version: 1,
  reviewedBy: "claude-code (requiere revisión humana)",
};

const subject = (patch: Partial<RevisionSubject> = {}): RevisionSubject => ({
  revisionId: "r1",
  benefit,
  trustLevel: "extracted",
  sources: [{ url: OFFICIAL_URL, text: OFFICIAL_HTML }],
  today: "2026-10-15",
  ...patch,
});

const fakeFetch = (status = 200): typeof fetch =>
  (async () =>
    new Response(OFFICIAL_HTML, {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    })) as typeof fetch;

/** The independent extraction a model would return for OFFICIAL_HTML. */
function llmBenefit(patch: Partial<LlmBenefit> = {}): LlmBenefit {
  const rule = (field: string, op: string, value: number, label: string, excerpt: string) => ({
    field,
    op,
    value,
    label,
    hard: false,
    excerpt,
  });
  return {
    slug: "bono-test",
    title: "Bono Nacimiento",
    summary: "Ayuda por nacimiento para familias empadronadas.",
    level: "state",
    region: null,
    municipality: null,
    category: "birth",
    kind: "call",
    agency: null,
    amount: { type: "fixed", min: 1000, max: null, text: "1.000 €" },
    window: { opensAt: "2026-01-01", closesAt: "2026-12-31", text: null },
    eligibility: {
      all: [
        rule("applicantAge", "gte", 18, "Mayor de edad", "las personas mayores de edad"),
        rule(
          "annualHouseholdIncome",
          "lte",
          40000,
          "Renta máxima",
          "La renta de la unidad familiar no podrá superar 40.000 euros",
        ),
      ],
      any: [],
      label: null,
    },
    otherRequirements: [],
    documents: [],
    steps: [],
    officialUrl: OFFICIAL_URL,
    faq: [],
    ...patch,
  } as LlmBenefit;
}

function fakeLlm(opts: { quoteVerdict?: string; amountMin?: number } = {}): LlmProvider {
  return {
    name: "fake",
    async extract(req) {
      const usage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 };
      if (req.system === VERIFY_QUOTES_SYSTEM) {
        return {
          model: "fake-model",
          usage,
          output: {
            checks: [0, 1].map((index) => ({
              index,
              verdict: index === 1 ? (opts.quoteVerdict ?? "supports") : "supports",
              explanation: "ok",
            })),
          } as never,
        };
      }
      return {
        model: "fake-model",
        usage,
        output: {
          isHouseholdBenefit: true,
          benefit: llmBenefit({
            amount: { type: "fixed", min: opts.amountMin ?? 1000, max: null, text: "x" },
          }),
          uncertainties: [],
        } as never,
      };
    },
  };
}

describe("quote matching", () => {
  it("tolerates whitespace, tag artefacts and [...] omissions, not paraphrases", () => {
    const text =
      "Cuantía: 600 euros, con carácter general , por ser familia numerosa. Además, 1.500 euros con cuatro hijos.";
    expect(
      findQuote(text, "600 euros, con carácter general, por ser familia numerosa"),
    ).toBeDefined();
    const omitted = findQuote(text, "600 euros [...] 1.500 euros con cuatro hijos");
    expect(omitted?.start).toBe(text.indexOf("600"));
    expect(omitted!.end).toBeGreaterThan(omitted!.start);
    expect(findQuote(text, "1.500 euros [...] 600 euros")).toBeUndefined();
    expect(findQuote(text, "600 € con carácter general")).toBeUndefined();
  });
});

describe("deterministic agents", () => {
  it("checks that every quote exists in the official text", async () => {
    expect((await citationsAgent.run(subject(), {})).verdict).toBe("pass");
    const tampered = await citationsAgent.run(
      subject({
        benefit: {
          ...benefit,
          eligibility: {
            all: [
              {
                field: "annualHouseholdIncome",
                op: "lte",
                value: 50000,
                label: "Renta",
                source: { excerpt: "no podrá superar 50.000 euros" },
              },
            ],
          },
        },
      }),
      {},
    );
    expect(tampered.verdict).toBe("fail");
    expect((await citationsAgent.run(subject({ sources: [] }), {})).verdict).toBe("uncertain");
  });

  it("checks deadlines", async () => {
    expect((await deadlinesAgent.run(subject(), {})).verdict).toBe("pass");
    const closed = await deadlinesAgent.run(subject({ today: "2027-02-01" }), {});
    expect(closed.verdict).toBe("fail");
    const inverted = await deadlinesAgent.run(
      subject({
        benefit: { ...benefit, window: { opensAt: "2026-12-01", closesAt: "2026-01-01" } },
      }),
      {},
    );
    expect(inverted.findings.map((f) => f.message)).toContain("Closes before it opens");
  });

  it("checks official links", async () => {
    expect((await linksAgent.run(subject(), { fetch: fakeFetch(200) })).verdict).toBe("pass");
    expect((await linksAgent.run(subject(), { fetch: fakeFetch(404) })).verdict).toBe("fail");
    expect((await linksAgent.run(subject(), { fetch: fakeFetch(503) })).verdict).toBe("uncertain");
  });

  it("compares two extractions field by field", () => {
    const other = { ...benefit, amount: { ...benefit.amount, min: 1500 } };
    const findings = compareContents(benefit, other);
    expect(findings).toEqual([
      expect.objectContaining({
        field: "amount.min",
        severity: "error",
        expected: 1500,
        actual: 1000,
      }),
    ]);
  });
});

describe("decision", () => {
  const allPass = {
    citations: "pass",
    "quote-check": "pass",
    "second-extraction": "pass",
    links: "pass",
    deadlines: "skipped",
  } as const;

  it("promotes only when every required agent passes", () => {
    expect(decide("extracted", allPass).trustLevel).toBe("agent_verified");
    expect(decide("extracted", { ...allPass, "quote-check": "skipped" })).toMatchObject({
      trustLevel: "extracted",
      needsHumanReview: false,
    });
  });

  it("demotes on failure or doubt, but keeps (and flags) human sign-offs", () => {
    expect(decide("agent_verified", { ...allPass, citations: "fail" })).toMatchObject({
      trustLevel: "extracted",
      needsHumanReview: true,
    });
    expect(decide("agent_verified", { ...allPass, links: "uncertain" }).trustLevel).toBe(
      "extracted",
    );
    expect(decide("human_verified", { ...allPass, citations: "fail" })).toMatchObject({
      trustLevel: "human_verified",
      needsHumanReview: true,
    });
  });
});

describe("verifyRevision", () => {
  async function setup() {
    const db = await createTestDb();
    await upsertSeedBenefit(db, benefit);
    await linkBenefitToRegistry(db, benefit, "2026-10-15");
    const [stored] = await listPublishedBenefits(db);
    return { db, revisionId: stored!.id };
  }

  it("verifies against the fetched official page and records an audit trail", async () => {
    const { db, revisionId } = await setup();
    const report = await verifyRevision(
      db,
      revisionId,
      { llm: fakeLlm(), fetch: fakeFetch() },
      { today: "2026-10-15" },
    );
    expect(report.decision).toMatchObject({
      trustLevel: "agent_verified",
      needsHumanReview: false,
    });
    expect(report.results["source-consistency"]?.verdict).toBe("skipped");

    const runs = await listVerificationRuns(db, revisionId);
    expect(runs).toHaveLength(7);
    expect(runs.find((r) => r.agent === "quote-check")).toMatchObject({
      verdict: "pass",
      model: "fake-model",
      agentVersion: "1",
    });
    const evidence = await listEvidence(db, revisionId);
    expect(evidence).toHaveLength(2);
    expect(evidence.every((e) => e.verified && e.documentId)).toBe(true);
    expect(await getProgramBySlug(db, "bono-test")).toMatchObject({ trustLevel: "agent_verified" });
  });

  it("does not promote when a quote contradicts its rule or the amounts differ", async () => {
    const { db, revisionId } = await setup();
    const contradicted = await verifyRevision(
      db,
      revisionId,
      { llm: fakeLlm({ quoteVerdict: "contradicts" }), fetch: fakeFetch() },
      { today: "2026-10-15" },
    );
    expect(contradicted.decision).toMatchObject({
      trustLevel: "extracted",
      needsHumanReview: true,
    });
    expect(contradicted.results["quote-check"]?.findings[0]?.field).toBe("all.1");

    const differentAmount = await verifyRevision(
      db,
      revisionId,
      { llm: fakeLlm({ amountMin: 1500 }), fetch: fakeFetch() },
      { today: "2026-10-15" },
    );
    expect(differentAmount.results["second-extraction"]?.verdict).toBe("fail");
    expect(differentAmount.decision.trustLevel).toBe("extracted");
  });

  it("without an LLM, records the deterministic checks and changes nothing", async () => {
    const { db, revisionId } = await setup();
    const report = await verifyRevision(
      db,
      revisionId,
      { fetch: fakeFetch() },
      { today: "2026-10-15" },
    );
    expect(report.results["quote-check"]?.verdict).toBe("skipped");
    expect(report.decision.trustLevel).toBe("extracted");
    expect(await getProgramBySlug(db, "bono-test")).toMatchObject({ trustLevel: "extracted" });
  });
});
