import type { Benefit } from "../src";

export function makeBenefit(overrides: Partial<Benefit> = {}): Benefit {
  return {
    id: overrides.slug ?? "test-benefit",
    slug: "test-benefit",
    title: "Ayuda de prueba",
    summary: "Una ayuda de prueba para los tests.",
    level: "state",
    category: "income",
    kind: "permanent",
    amount: { type: "fixed", min: 100, text: "100 €" },
    eligibility: { all: [{ field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" }] },
    otherRequirements: [],
    documents: [],
    steps: [],
    officialUrl: "https://example.org",
    sources: [{ url: "https://example.org", retrievedAt: "2026-10-14" }],
    faq: [],
    status: "published",
    version: 1,
    reviewedBy: "admin",
    reviewedAt: "2026-10-14",
    ...overrides,
  };
}
