import {
  evaluate,
  finalizeAnswers,
  QUESTIONS,
  selectQuestions,
  type BenefitMatch,
  type HouseholdProfile,
} from "@tetoca/core";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog";

const { benefits, issues } = loadCatalog();
const published = benefits.filter((b) => b.status === "published");
/** Published plus archived editions: their rules are still real-world fixtures. */
const curated = benefits.filter((b) => b.status !== "draft");

/** Fixed date so results don't depend on when the tests run. */
const TODAY = "2026-10-14";

function statusOf(profile: HouseholdProfile, slug: string, today = TODAY) {
  const match = evaluate(profile, curated, { today, includeClosed: true }).find(
    (m) => m.benefit.slug === slug,
  );
  if (!match) throw new Error(`Benefit ${slug} not found`);
  return match;
}

const statuses = (matches: BenefitMatch[]) =>
  Object.fromEntries(matches.map((m) => [m.benefit.slug, m.status]));

// --- Realistic household fixtures (Valladolid unless stated) ---------------

/** Single mother, 1 baby, low income, renting. */
const singleMotherBaby: HouseholdProfile = {
  region: "CL",
  municipality: "47186",
  applicantAge: 29,
  householdSize: 2,
  children: [{ age: 0, disabilityPercent: 0 }],
  isSingleParent: true,
  isLargeFamily: false,
  annualHouseholdIncome: 9000,
  employmentStatus: "employed",
  housing: "renting",
  monthlyRent: 500,
  hasDependentPerson: false,
  applicantDisabilityPercent: 0,
  yearsRegisteredInRegion: 5,
  yearsLegalResidenceInSpain: 5,
  receivesMinimumIncome: false,
};

/** Couple with 3 children (large family), middle income, mortgage. */
const largeFamily: HouseholdProfile = {
  region: "CL",
  municipality: "other",
  applicantAge: 41,
  householdSize: 5,
  children: [
    { age: 2, disabilityPercent: 0 },
    { age: 6, disabilityPercent: 0 },
    { age: 10, disabilityPercent: 40 },
  ],
  isSingleParent: false,
  isLargeFamily: true,
  annualHouseholdIncome: 42000,
  employmentStatus: "employed",
  housing: "owner_mortgage",
  hasDependentPerson: false,
  applicantDisabilityPercent: 0,
  yearsRegisteredInRegion: 5,
  yearsLegalResidenceInSpain: 5,
  receivesMinimumIncome: false,
};

/** Young person living alone, unemployed, no income, outside Castilla y León. */
const youngOutside: HouseholdProfile = {
  region: "OTHER",
  applicantAge: 24,
  householdSize: 1,
  children: [],
  isSingleParent: false,
  isLargeFamily: false,
  annualHouseholdIncome: 0,
  employmentStatus: "unemployed",
  housing: "other",
  hasDependentPerson: false,
  applicantDisabilityPercent: 0,
  yearsLegalResidenceInSpain: 5,
  receivesMinimumIncome: false,
};

describe("curated catalog", () => {
  it("has no validation issues", () => {
    expect(issues).toEqual([]);
  });

  it("has at least 15 published benefits", () => {
    expect(published.length).toBeGreaterThanOrEqual(15);
  });

  it("every published benefit has steps, an official URL and sources", () => {
    for (const b of published) {
      expect(b.steps.length, b.slug).toBeGreaterThan(0);
      expect(b.sources.length, b.slug).toBeGreaterThan(0);
      expect(b.summary.length, b.slug).toBeLessThanOrEqual(400);
    }
  });

  it("uses unique slugs", () => {
    const slugs = benefits.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("single mother with a baby in Valladolid", () => {
  const r = statuses(evaluate(singleMotherBaby, published, { today: TODAY }));

  it("gets the birth-related benefits", () => {
    expect(r["bono-nacimiento-castilla-y-leon"]).toBe("eligible");
    expect(r["deduccion-maternidad"]).toBe("eligible");
    expect(r["prestacion-nacimiento-cuidado-menor"]).toBe("eligible");
    expect(r["complemento-ayuda-infancia"]).toBe("eligible");
  });

  it("qualifies for the bono social by income", () => {
    // Threshold: 8.400 × (1.5 + 0.5 per minor) = 16.800 € ≥ 9.000 €
    expect(r["bono-social-electrico"]).toBe("eligible");
    expect(r["bono-social-termico"]).toBe("eligible");
  });

  it("gets the IMV thanks to the single-parent supplement", () => {
    // 8.803,20 × (1.3 + 0.22) − 120 = 13.260,86 € > 9.000 €
    expect(r["ingreso-minimo-vital"]).toBe("eligible");
  });

  it("is told that the rent call is closed (excluded by default)", () => {
    expect(r["ayudas-alquiler-vivienda-castilla-y-leon"]).toBeUndefined();
    expect(statusOf(singleMotherBaby, "ayudas-alquiler-vivienda-castilla-y-leon").window).toBe(
      "closed",
    );
    expect(statusOf(singleMotherBaby, "ayudas-alquiler-vivienda-castilla-y-leon").status).toBe(
      "eligible",
    );
  });

  it("household composition is never 'almost': one child is not two", () => {
    const m = statusOf(singleMotherBaby, "deduccion-ascendiente-dos-hijos");
    expect(m.status).toBe("not_eligible");
    expect(m.failed.map((f) => f.label)).toEqual(["Tener dos hijos a cargo"]);
  });

  it("a rent slightly above the limit is 'almost', with the reason", () => {
    const m = statusOf(
      { ...singleMotherBaby, monthlyRent: 600 },
      "ayudas-alquiler-vivienda-castilla-y-leon",
    );
    expect(m.status).toBe("almost");
    expect(m.failed[0]?.label).toContain("550");
  });

  it("is within the age range of the driving licence aid", () => {
    expect(r["ayudas-permiso-conducir-jovenes-castilla-y-leon"]).toBe("eligible");
  });
});

describe("large family with a disabled child", () => {
  const r = statuses(evaluate(largeFamily, published, { today: TODAY }));

  it("gets the large family and disability benefits", () => {
    expect(r["deduccion-familia-numerosa"]).toBe("eligible");
    expect(r["deduccion-descendiente-discapacidad"]).toBe("eligible");
    expect(r["deduccion-maternidad"]).toBe("eligible");
  });

  it("gets the bono social without income test (large family)", () => {
    expect(r["bono-social-electrico"]).toBe("eligible");
  });

  it("does not get income-tested minimum income benefits", () => {
    // Minimum-income thresholds are hard: earning far more is not "almost".
    expect(r["ingreso-minimo-vital"]).toBe("not_eligible");
    expect(r["renta-garantizada-ciudadania-castilla-y-leon"]).toBe("not_eligible");
  });

  it("gets the CAPI: income below 3 × the guaranteed income for 5 people", () => {
    // 3 × 8.803,20 × min(2.2, 0.7 + 0.3 × 5 = 2.2) = 58.101,12 € > 42.000 €
    expect(r["complemento-ayuda-infancia"]).toBe("eligible");
  });

  it("is not eligible for the baby bonus (no child born this year)", () => {
    expect(r["bono-nacimiento-castilla-y-leon"]).toBe("not_eligible");
  });
});

describe("young unemployed person outside Castilla y León", () => {
  const r = statuses(evaluate(youngOutside, published, { today: TODAY }));

  it("never gets regional benefits, and they are never 'almost'", () => {
    for (const b of published.filter((b) => b.level !== "state")) {
      expect(r[b.slug] ?? "closed", b.slug).not.toMatch(/^(eligible|almost)$/);
    }
  });

  it("gets the IMV and the bono social", () => {
    expect(r["ingreso-minimo-vital"]).toBe("eligible");
    expect(r["bono-social-electrico"]).toBe("eligible");
  });

  it("does not get birth benefits", () => {
    expect(r["deduccion-maternidad"]).toBe("not_eligible");
    expect(r["complemento-ayuda-infancia"]).toBe("not_eligible");
  });
});

describe("benefit-specific edge cases", () => {
  it("IMV: 22-year-old without children is almost (age)", () => {
    const m = statusOf({ ...youngOutside, applicantAge: 22 }, "ingreso-minimo-vital");
    expect(m.status).toBe("almost");
  });

  it("IMV: 20-year-old with a child qualifies by age", () => {
    const m = statusOf(
      { ...youngOutside, applicantAge: 20, householdSize: 2, children: [{ age: 1 }] },
      "ingreso-minimo-vital",
    );
    expect(m.status).toBe("eligible");
  });

  it("IMV: less than a year of legal residence is almost", () => {
    const m = statusOf({ ...youngOutside, yearsLegalResidenceInSpain: 0 }, "ingreso-minimo-vital");
    expect(m.status).toBe("almost");
  });

  it("IMV: income must be at least 10 €/month below the guaranteed income", () => {
    // Single adult: 8.803,20 − 120 = 8.683,20
    const at = statusOf({ ...youngOutside, annualHouseholdIncome: 8683.2 }, "ingreso-minimo-vital");
    const below = statusOf(
      { ...youngOutside, annualHouseholdIncome: 8683 },
      "ingreso-minimo-vital",
    );
    expect(at.status).toBe("not_eligible");
    expect(below.status).toBe("eligible");
  });

  it("bono social: two adults and two minors up to 23.520 € (official example)", () => {
    const family: HouseholdProfile = {
      ...largeFamily,
      isLargeFamily: false,
      householdSize: 4,
      children: [
        { age: 3, disabilityPercent: 0 },
        { age: 7, disabilityPercent: 0 },
      ],
    };
    expect(
      statusOf({ ...family, annualHouseholdIncome: 23520 }, "bono-social-electrico").status,
    ).toBe("eligible");
    expect(
      statusOf({ ...family, annualHouseholdIncome: 23521 }, "bono-social-electrico").status,
    ).toBe("almost");
  });

  it("bono social: disability adds 1 IPREM (31.920 € for 2 adults + 2 minors)", () => {
    const family: HouseholdProfile = {
      ...largeFamily,
      isLargeFamily: false,
      householdSize: 4,
      applicantDisabilityPercent: 33,
      children: [
        { age: 3, disabilityPercent: 0 },
        { age: 7, disabilityPercent: 0 },
      ],
      annualHouseholdIncome: 31920,
    };
    expect(statusOf(family, "bono-social-electrico").status).toBe("eligible");
  });

  it("rent aid: income below 0.5 IPREM is almost", () => {
    const m = statusOf(
      { ...singleMotherBaby, annualHouseholdIncome: 3000 },
      "ayudas-alquiler-vivienda-castilla-y-leon",
    );
    expect(m.status).toBe("almost");
    expect(m.failed[0]?.label).toContain("0,5 veces el IPREM");
  });

  it("rent aid: large family may pay up to 800 € rent", () => {
    const m = statusOf(
      { ...largeFamily, housing: "renting", monthlyRent: 750, annualHouseholdIncome: 30000 },
      "ayudas-alquiler-vivienda-castilla-y-leon",
    );
    expect(m.status).toBe("eligible");
  });

  it("driving licence: needs 5 years registered in Castilla y León", () => {
    const m = statusOf(
      { ...singleMotherBaby, applicantAge: 19, yearsRegisteredInRegion: 2 },
      "ayudas-permiso-conducir-jovenes-castilla-y-leon",
    );
    expect(m.status).toBe("almost");
  });

  it("driving licence: 31-year-olds are out", () => {
    const m = statusOf(
      { ...singleMotherBaby, applicantAge: 31 },
      "ayudas-permiso-conducir-jovenes-castilla-y-leon",
    );
    expect(m.status).toBe("almost");
  });

  it("university enrolment: a parent with an 18-year-old child", () => {
    const m = statusOf(
      { ...largeFamily, children: [{ age: 18, disabilityPercent: 0 }] },
      "ayudas-primera-matricula-universitaria-castilla-y-leon",
    );
    expect(m.status).toBe("eligible");
  });

  it("university enrolment call disappears after its deadline", () => {
    const after = evaluate(largeFamily, published, { today: "2026-10-22" }).map(
      (m) => m.benefit.slug,
    );
    expect(after).not.toContain("ayudas-primera-matricula-universitaria-castilla-y-leon");
  });

  it("work-life balance aid excludes the self-employed", () => {
    const m = statusOf(
      { ...largeFamily, employmentStatus: "self_employed", annualHouseholdIncome: 30000 },
      "conciliacion-reduccion-jornada-excedencia-castilla-y-leon",
    );
    expect(m.status).toBe("almost");
  });

  it("dependency: asks before deciding", () => {
    const { hasDependentPerson: _omit, ...rest } = largeFamily;
    expect(statusOf(rest, "reconocimiento-dependencia-castilla-y-leon").status).toBe("unknown");
  });

  it("renta garantizada: low income, registered for over a year", () => {
    const m = statusOf(
      {
        ...youngOutside,
        region: "CL",
        applicantAge: 30,
        yearsRegisteredInRegion: 2,
        annualHouseholdIncome: 3000,
      },
      "renta-garantizada-ciudadania-castilla-y-leon",
    );
    expect(m.status).toBe("eligible");
  });
});

describe("questionnaire length with the real catalog", () => {
  /** Simulates the questionnaire answering from a full profile. */
  function askedQuestions(full: HouseholdProfile): string[] {
    const answers: Partial<HouseholdProfile> = {};
    const asked: string[] = [];
    for (let guard = 0; guard < 40; guard++) {
      const next = selectQuestions(published, answers, undefined, { today: TODAY }).find(
        (q) => !asked.includes(q.id),
      );
      if (!next) break;
      asked.push(next.id);
      for (const f of next.fields) (answers as Record<string, unknown>)[f] = full[f];
    }
    return asked;
  }

  it.each([
    ["single mother", singleMotherBaby],
    ["large family", largeFamily],
    ["young outside", youngOutside],
  ])("%s answers at most 13 questions", (_name, profile) => {
    const asked = askedQuestions(profile);
    expect(asked.length).toBeLessThanOrEqual(13);
  });

  it("gets the same results as answering everything", () => {
    for (const profile of [singleMotherBaby, largeFamily, youngOutside]) {
      const answers: Partial<HouseholdProfile> = { region: profile.region };
      for (const id of askedQuestions(profile)) {
        const q = QUESTIONS.find((x) => x.id === id)!;
        for (const f of q.fields) (answers as Record<string, unknown>)[f] = profile[f];
      }
      const partial = statuses(
        evaluate(finalizeAnswers(answers) as HouseholdProfile, published, { today: TODAY }),
      );
      const complete = statuses(evaluate(profile, published, { today: TODAY }));
      // Skipped questions can only leave results "unknown" where the full
      // answers would not have changed the outcome category.
      for (const [slug, status] of Object.entries(complete)) {
        if (partial[slug] !== status) expect([slug, partial[slug]]).toEqual([slug, "unknown"]);
      }
    }
  });
});
