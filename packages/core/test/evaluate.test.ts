import { describe, expect, it } from "vitest";
import {
  evaluateRules,
  evaluateValueExpr,
  getConstants,
  type HouseholdProfile,
  type RuleGroup,
} from "../src";

const constants = getConstants(2026);
const run = (rules: RuleGroup, profile: Partial<HouseholdProfile>, almostMaxFailed?: number) =>
  evaluateRules(rules, { region: "CL", ...profile }, { constants, almostMaxFailed });

describe("comparison operators", () => {
  const cases: [string, RuleGroup, Partial<HouseholdProfile>, string][] = [
    [
      "eq pass",
      { all: [{ field: "housing", op: "eq", value: "renting", label: "x" }] },
      { housing: "renting" },
      "eligible",
    ],
    [
      "eq fail",
      { all: [{ field: "housing", op: "eq", value: "renting", label: "x" }] },
      { housing: "other" },
      "almost",
    ],
    [
      "neq pass",
      { all: [{ field: "housing", op: "neq", value: "renting", label: "x" }] },
      { housing: "other" },
      "eligible",
    ],
    [
      "neq fail",
      { all: [{ field: "housing", op: "neq", value: "renting", label: "x" }] },
      { housing: "renting" },
      "almost",
    ],
    [
      "lt pass",
      { all: [{ field: "applicantAge", op: "lt", value: 36, label: "x" }] },
      { applicantAge: 35 },
      "eligible",
    ],
    [
      "lt boundary",
      { all: [{ field: "applicantAge", op: "lt", value: 36, label: "x" }] },
      { applicantAge: 36 },
      "almost",
    ],
    [
      "lte boundary",
      { all: [{ field: "applicantAge", op: "lte", value: 35, label: "x" }] },
      { applicantAge: 35 },
      "eligible",
    ],
    [
      "lte fail",
      { all: [{ field: "applicantAge", op: "lte", value: 35, label: "x" }] },
      { applicantAge: 36 },
      "almost",
    ],
    [
      "gt pass",
      { all: [{ field: "applicantAge", op: "gt", value: 17, label: "x" }] },
      { applicantAge: 18 },
      "eligible",
    ],
    [
      "gt boundary",
      { all: [{ field: "applicantAge", op: "gt", value: 18, label: "x" }] },
      { applicantAge: 18 },
      "almost",
    ],
    [
      "gte boundary",
      { all: [{ field: "applicantAge", op: "gte", value: 18, label: "x" }] },
      { applicantAge: 18 },
      "eligible",
    ],
    [
      "gte fail",
      { all: [{ field: "applicantAge", op: "gte", value: 18, label: "x" }] },
      { applicantAge: 17 },
      "almost",
    ],
    [
      "in pass",
      {
        all: [
          { field: "employmentStatus", op: "in", value: ["employed", "self_employed"], label: "x" },
        ],
      },
      { employmentStatus: "employed" },
      "eligible",
    ],
    [
      "in fail",
      {
        all: [
          { field: "employmentStatus", op: "in", value: ["employed", "self_employed"], label: "x" },
        ],
      },
      { employmentStatus: "student" },
      "almost",
    ],
    [
      "boolean eq",
      { all: [{ field: "isLargeFamily", op: "eq", value: true, label: "x" }] },
      { isLargeFamily: true },
      "eligible",
    ],
    [
      "boolean eq false answer",
      { all: [{ field: "isLargeFamily", op: "eq", value: true, label: "x" }] },
      { isLargeFamily: false },
      "almost",
    ],
    [
      "exists pass",
      { all: [{ op: "exists", field: "monthlyRent", label: "x" }] },
      { monthlyRent: 400 },
      "eligible",
    ],
    [
      "exists unknown",
      { all: [{ op: "exists", field: "monthlyRent", label: "x" }] },
      {},
      "unknown",
    ],
    [
      "exists null fails",
      { all: [{ op: "exists", field: "youngestChildAge", label: "x" }] },
      { children: [] },
      "almost",
    ],
  ];
  it.each(cases)("%s", (_name, rules, profile, expected) => {
    expect(run(rules, profile).status).toBe(expected);
  });

  it("ordering ops on non-numbers are reported as unknown, not guessed", () => {
    const rules: RuleGroup = { all: [{ field: "housing", op: "lt", value: 3, label: "bad" }] };
    expect(run(rules, { housing: "renting" }).status).toBe("unknown");
  });

  it("`in` with a non-array value is unknown", () => {
    const rules: RuleGroup = {
      all: [{ field: "housing", op: "in", value: "renting", label: "bad" }],
    };
    expect(run(rules, { housing: "renting" }).status).toBe("unknown");
  });
});

describe("missing data", () => {
  const rules: RuleGroup = {
    all: [
      { field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" },
      { field: "annualHouseholdIncome", op: "lt", value: 20000, label: "Ingresos < 20.000 €" },
    ],
  };

  it("never assumes: a missing field makes the result unknown", () => {
    const r = run(rules, { applicantAge: 30 });
    expect(r.status).toBe("unknown");
    expect(r.met.map((m) => m.label)).toEqual(["Mayor de edad"]);
    expect(r.unknown.map((m) => m.label)).toEqual(["Ingresos < 20.000 €"]);
  });

  it("a known failure plus an unknown is still almost (one failed requirement)", () => {
    const r = run(rules, { applicantAge: 16 });
    expect(r.status).toBe("almost");
    expect(r.failed.map((f) => f.label)).toEqual(["Mayor de edad"]);
    expect(r.unknown).toHaveLength(1);
  });

  it("an empty profile yields unknown with no met requirements", () => {
    const r = run(rules, {});
    expect(r.status).toBe("unknown");
    expect(r.met).toHaveLength(0);
  });
});

describe("almost / not_eligible", () => {
  const rules: RuleGroup = {
    all: [
      { field: "applicantAge", op: "lte", value: 35, label: "Edad ≤ 35" },
      { field: "housing", op: "eq", value: "renting", label: "Vivir de alquiler" },
      { field: "annualHouseholdIncome", op: "lte", value: 25200, label: "Ingresos ≤ 3 IPREM" },
    ],
  };

  it("two failed requirements is not eligible", () => {
    const r = run(rules, {
      applicantAge: 40,
      housing: "owner_mortgage",
      annualHouseholdIncome: 1000,
    });
    expect(r.status).toBe("not_eligible");
    expect(r.failed).toHaveLength(2);
  });

  it("almostMaxFailed is configurable", () => {
    const r = run(
      rules,
      { applicantAge: 40, housing: "owner_mortgage", annualHouseholdIncome: 1000 },
      2,
    );
    expect(r.status).toBe("almost");
  });

  it("a hard requirement failure is never almost", () => {
    const hard: RuleGroup = {
      all: [{ field: "region", op: "eq", value: "XX", label: "Vivir en XX", hard: true }],
    };
    expect(run(hard, {}).status).toBe("not_eligible");
  });

  it("hard groups make all their requirements hard", () => {
    const hard: RuleGroup = {
      all: [
        { all: [{ field: "applicantAge", op: "lt", value: 30, label: "< 30" }], hard: true },
        { field: "housing", op: "eq", value: "renting", label: "alquiler" },
      ],
    };
    const r = run(hard, { applicantAge: 40, housing: "renting" });
    expect(r.status).toBe("not_eligible");
    expect(r.failed[0]).toMatchObject({ label: "< 30", hard: true });
  });
});

describe("rule groups", () => {
  const anyRules: RuleGroup = {
    all: [{ field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" }],
    any: [
      { field: "isLargeFamily", op: "eq", value: true, label: "Familia numerosa" },
      { field: "isSingleParent", op: "eq", value: true, label: "Familia monoparental" },
    ],
  };

  it("any passes when one branch passes and reports the passing label", () => {
    const r = run(anyRules, { applicantAge: 30, isLargeFamily: false, isSingleParent: true });
    expect(r.status).toBe("eligible");
    expect(r.met.map((m) => m.label)).toContain("Familia monoparental");
  });

  it("a failing any group counts as a single requirement", () => {
    const r = run(anyRules, { applicantAge: 30, isLargeFamily: false, isSingleParent: false });
    expect(r.status).toBe("almost");
    expect(r.failed.map((f) => f.label)).toEqual(["Familia numerosa o Familia monoparental"]);
  });

  it("any with an unknown branch and no pass is unknown", () => {
    const r = run(anyRules, { applicantAge: 30, isLargeFamily: false });
    expect(r.status).toBe("unknown");
  });

  it("uses the group label when provided", () => {
    const labelled: RuleGroup = { any: anyRules.any, label: "Familia con especial protección" };
    const r = run(labelled, { isLargeFamily: false, isSingleParent: false });
    expect(r.failed.map((f) => f.label)).toEqual(["Familia con especial protección"]);
  });

  it("nested all groups inside any report their joined labels", () => {
    const nested: RuleGroup = {
      any: [
        {
          all: [
            { field: "householdSize", op: "eq", value: 1, label: "Vive solo" },
            {
              field: "annualHouseholdIncome",
              op: "lte",
              value: 10000,
              label: "Ingresos ≤ 10.000 €",
            },
          ],
        },
        { field: "isLargeFamily", op: "eq", value: true, label: "Familia numerosa" },
      ],
    };
    const r = run(nested, { householdSize: 1, annualHouseholdIncome: 5000, isLargeFamily: false });
    expect(r.status).toBe("eligible");
    expect(r.met[0]?.label).toBe("Vive solo y Ingresos ≤ 10.000 €");
  });

  it("nested all groups inside all are flattened into separate requirements", () => {
    const nested: RuleGroup = {
      all: [
        { all: [{ field: "applicantAge", op: "gte", value: 18, label: "A" }] },
        { field: "housing", op: "eq", value: "renting", label: "B" },
      ],
    };
    const r = run(nested, { applicantAge: 20, housing: "renting" });
    expect(r.met.map((m) => m.label)).toEqual(["A", "B"]);
  });

  it("an empty all group is trivially eligible", () => {
    expect(run({ all: [] }, {}).status).toBe("eligible");
  });

  it("keeps rule sources in the results", () => {
    const r = run(
      {
        all: [
          {
            field: "applicantAge",
            op: "gte",
            value: 18,
            label: "A",
            source: { excerpt: "mayores de edad" },
          },
        ],
      },
      { applicantAge: 30 },
    );
    expect(r.met[0]?.source?.excerpt).toBe("mayores de edad");
  });
});

describe("value expressions", () => {
  const ctx = (profile: Partial<HouseholdProfile>) => ({
    profile: { region: "CL", ...profile },
    constants,
  });

  it("resolves constants", () => {
    expect(evaluateValueExpr({ ref: "iprem14" }, ctx({}))).toBe(8400);
  });

  it("computes the bono social style threshold", () => {
    // 1.5 × IPREM14 + 0.3 per extra adult + 0.5 per minor
    const expr = {
      mul: [
        { ref: "iprem14" as const },
        {
          add: [
            1.5,
            { mul: [0.3, { ref: "extraAdults" as const }] },
            { mul: [0.5, { ref: "numMinors" as const }] },
          ],
        },
      ],
    };
    const value = evaluateValueExpr(
      expr,
      ctx({ householdSize: 4, children: [{ age: 3 }, { age: 7 }] }),
    );
    // 2 adults (1 extra) and 2 minors → 1.5 + 0.3 + 1.0 = 2.8 × 8400
    expect(value).toBeCloseTo(23520);
  });

  it("supports min() to cap a scale", () => {
    const scale = { min: [2.2, { add: [0.7, { mul: [0.3, { ref: "householdSize" as const }] }] }] };
    expect(evaluateValueExpr(scale, ctx({ householdSize: 2 }))).toBeCloseTo(1.3);
    expect(evaluateValueExpr(scale, ctx({ householdSize: 10 }))).toBe(2.2);
  });

  it("is unknown if a referenced field is unknown", () => {
    expect(evaluateValueExpr({ add: [1, { ref: "numMinors" }] }, ctx({}))).toBeUndefined();
  });

  it("is unknown if a referenced field is not numeric", () => {
    expect(evaluateValueExpr({ ref: "housing" }, ctx({ housing: "renting" }))).toBeUndefined();
  });

  it("drives rule comparisons and yields unknown when it cannot be computed", () => {
    const rules: RuleGroup = {
      all: [
        {
          field: "annualHouseholdIncome",
          op: "lte",
          value: { mul: [3, { ref: "iprem14" }] },
          label: "Ingresos ≤ 3 IPREM",
        },
        {
          field: "annualHouseholdIncome",
          op: "lte",
          value: { mul: [{ ref: "iprem14" }, { ref: "householdSize" }] },
          label: "Ingresos ≤ IPREM por miembro",
        },
      ],
    };
    expect(run(rules, { annualHouseholdIncome: 25200, householdSize: 3 }).status).toBe("eligible");
    expect(run(rules, { annualHouseholdIncome: 25201, householdSize: 4 }).status).toBe("almost");
    expect(run(rules, { annualHouseholdIncome: 100 }).status).toBe("unknown");
  });
});
