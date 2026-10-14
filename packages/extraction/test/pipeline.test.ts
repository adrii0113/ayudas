import { getBenefitById, saveSourceDocument, getExtraction, type Database } from "@tetoca/db";
import { createTestDb } from "@tetoca/db/testing";
import type { LlmProvider, StructuredResponse } from "@tetoca/llm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { extractDocument, llmExtractionSchema, type LlmExtraction } from "../src";

const SOURCE_TEXT = `# Orden de ayudas para el permiso de conducción
Podrán ser beneficiarias las personas físicas que cumplan los siguientes requisitos:
a) Tener una edad mínima de 18 años y, como máximo, cumplir 30 años dentro del presente año.
b) Residir y estar empadronadas en Castilla y León con al menos cinco años de antelación.
El plazo será desde el 1 de octubre de 2026 hasta el 15 de enero de 2027.`;

const validExtraction = (): LlmExtraction => ({
  isHouseholdBenefit: true,
  uncertainties: ["No se indica la sede electrónica."],
  benefit: {
    slug: "permiso-conducir-jovenes-castilla-y-leon-2026",
    title: "Ayudas para el carné de conducir",
    summary: "Hasta 900 € para jóvenes que se saquen el carné B.",
    level: "regional",
    region: "CL",
    municipality: null,
    category: "employment",
    kind: "call",
    agency: "Junta de Castilla y León",
    amount: { type: "range", min: 450, max: 900, text: "Hasta 900 €" },
    window: { opensAt: "2026-10-01", closesAt: "2027-01-15", text: null },
    eligibility: {
      all: [
        {
          field: "applicantAge",
          op: "gte",
          value: 18,
          label: "Tener 18 años o más",
          hard: false,
          excerpt: "Tener una edad mínima de 18 años",
        },
        {
          field: "yearsRegisteredInRegion",
          op: "gte",
          value: 5,
          label: "5 años empadronado",
          hard: false,
          excerpt: "con al menos cinco años de antelación",
        },
      ],
      any: [],
      label: null,
    },
    otherRequirements: [],
    documents: [],
    steps: ["Solicítalo en la sede electrónica."],
    officialUrl: null,
    faq: [],
  },
});

class FakeLlm implements LlmProvider {
  readonly name = "fake";
  calls: { prompt: string }[] = [];
  constructor(private readonly responses: (LlmExtraction | null | "refusal")[]) {}
  async extract<T extends z.ZodType>(req: {
    prompt: string;
  }): Promise<StructuredResponse<z.infer<T>>> {
    this.calls.push({ prompt: req.prompt });
    const next = this.responses.shift() ?? null;
    const usage = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0 };
    if (next === "refusal") return { output: null, failure: "refusal", model: "fake", usage };
    return { output: next as z.infer<T>, model: "fake", usage };
  }
}

let db: Database;
let documentId: string;

beforeEach(async () => {
  db = await createTestDb();
  const { document } = await saveSourceDocument(db, {
    source: "bdns",
    externalId: "932041",
    url: "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/932041",
    title: "Permiso de conducción",
    text: SOURCE_TEXT,
    contentHash: "hash-1",
  });
  documentId = document.id;
});

describe("extraction schema", () => {
  it("is not recursive (structured outputs requirement)", () => {
    expect(() => z.toJSONSchema(llmExtractionSchema, { cycles: "throw" })).not.toThrow();
  });
});

describe("extractDocument", () => {
  it("creates a draft (never published) with traceable sources", async () => {
    const llm = new FakeLlm([validExtraction()]);
    const outcome = await extractDocument({ db, llm, documentId });
    expect(outcome.status).toBe("draft_created");
    if (outcome.status !== "draft_created") return;

    const stored = await getBenefitById(db, outcome.benefitId);
    expect(stored?.benefit.status).toBe("draft");
    expect(stored?.row.sourceDocumentId).toBe(documentId);
    expect(stored?.benefit.sources[0]?.url).toContain("932041");
    expect(stored?.benefit.officialUrl).toContain("932041");
    const firstRule = stored?.benefit.eligibility.all?.[0];
    expect(firstRule && "source" in firstRule ? firstRule.source?.excerpt : null).toBe(
      "Tener una edad mínima de 18 años",
    );

    const extraction = await getExtraction(db, outcome.extractionId);
    expect(extraction).toMatchObject({
      promptVersion: "extract-benefit@1",
      attempts: 1,
      status: "succeeded",
    });
  });

  it("uses the cache for the same document and prompt version", async () => {
    await extractDocument({ db, llm: new FakeLlm([validExtraction()]), documentId });
    const llm = new FakeLlm([]);
    const again = await extractDocument({ db, llm, documentId });
    expect(again.status).toBe("cached");
    expect(llm.calls).toHaveLength(0);
  });

  it("retries once with the validation errors as feedback", async () => {
    const bad = validExtraction();
    bad.benefit!.eligibility.all[0] = {
      ...(bad.benefit!.eligibility.all[0] as object),
      field: "housing",
      op: "lt",
      value: 3,
    } as never;
    const llm = new FakeLlm([bad, validExtraction()]);
    const outcome = await extractDocument({ db, llm, documentId });
    expect(outcome.status).toBe("draft_created");
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]?.prompt).toContain("only applies to numeric fields");
  });

  it("marks for manual review after two invalid outputs", async () => {
    const bad = validExtraction();
    bad.benefit!.kind = "call";
    bad.benefit!.window = { opensAt: null, closesAt: null, text: null };
    const llm = new FakeLlm([bad, bad]);
    const outcome = await extractDocument({ db, llm, documentId });
    expect(outcome.status).toBe("needs_manual_review");
    if (outcome.status !== "needs_manual_review") return;
    expect((await getExtraction(db, outcome.extractionId!))?.status).toBe("invalid_output");
  });

  it("does not retry a refusal", async () => {
    const llm = new FakeLlm(["refusal"]);
    expect((await extractDocument({ db, llm, documentId })).status).toBe("needs_manual_review");
    expect(llm.calls).toHaveLength(1);
  });

  it("does not create drafts for non-household calls", async () => {
    const llm = new FakeLlm([
      { isHouseholdBenefit: false, benefit: null, uncertainties: ["Ayuda a empresas"] },
    ]);
    expect((await extractDocument({ db, llm, documentId })).status).toBe("not_a_household_benefit");
  });

  it("flags excerpts that are not literally in the source", async () => {
    const e = validExtraction();
    (e.benefit!.eligibility.all[1] as { excerpt: string }).excerpt = "texto inventado";
    const outcome = await extractDocument({ db, llm: new FakeLlm([e]), documentId });
    expect(outcome.status === "draft_created" && outcome.uncertainties.at(-1)).toContain(
      "5 años empadronado",
    );
  });

  it("skips scanned documents", async () => {
    const { document } = await saveSourceDocument(db, {
      source: "bdns",
      url: "https://example.org",
      title: "Escaneado",
      text: "",
      contentHash: "hash-2",
      needsManualReview: true,
    });
    const llm = new FakeLlm([]);
    expect((await extractDocument({ db, llm, documentId: document.id })).status).toBe(
      "needs_manual_review",
    );
    expect(llm.calls).toHaveLength(0);
  });
});
