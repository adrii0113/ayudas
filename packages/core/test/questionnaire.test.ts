import { describe, expect, it } from "vitest";
import { OUTSIDE_REGIONS, relevantFields, selectQuestions } from "../src";
import { makeBenefit } from "./helpers";

const ids = (qs: { id: string }[]) => qs.map((q) => q.id);

describe("adaptive questionnaire", () => {
  const rent = makeBenefit({
    slug: "rent",
    level: "regional",
    region: "CL",
    eligibility: {
      all: [
        { field: "housing", op: "eq", value: "renting", label: "alquiler" },
        { field: "monthlyRent", op: "lte", value: 600, label: "renta" },
        {
          field: "annualHouseholdIncome",
          op: "lte",
          value: { mul: [3, { ref: "iprem14" }] },
          label: "ingresos",
        },
      ],
    },
  });
  const birth = makeBenefit({
    slug: "birth",
    eligibility: {
      all: [{ field: "youngestChildAge", op: "lt", value: 3, label: "hijo < 3" }],
      any: [{ op: "exists", field: "isSingleParent", label: "monoparental" }],
    },
  });
  const expr = makeBenefit({
    slug: "expr",
    eligibility: {
      all: [
        {
          field: "annualHouseholdIncome",
          op: "lte",
          value: { mul: [{ ref: "iprem14" }, { add: [1.5, { ref: "extraAdults" }] }] },
          label: "x",
        },
      ],
    },
  });

  it("collects fields from rules, derived fields and value expressions", () => {
    const fields = relevantFields([rent, birth, expr]);
    expect([...fields].sort()).toEqual(
      [
        "annualHouseholdIncome",
        "children",
        "householdSize",
        "housing",
        "isSingleParent",
        "monthlyRent",
        "region",
      ].sort(),
    );
  });

  it("only asks what some active benefit needs", () => {
    expect(ids(selectQuestions([rent], { region: "CL" }))).toEqual([
      "region",
      "annualHouseholdIncome",
      "housing",
    ]);
  });

  it("asks follow-ups depending on previous answers", () => {
    expect(ids(selectQuestions([rent], { region: "CL", housing: "renting" }))).toContain(
      "monthlyRent",
    );
    expect(ids(selectQuestions([birth], { region: "CL", children: [{ age: 1 }] }))).toEqual([
      "region",
      "children",
      "childrenDisability",
      "isSingleParent",
    ]);
    expect(ids(selectQuestions([birth], { region: "CL", children: [] }))).toEqual([
      "region",
      "children",
    ]);
  });

  it("asks for municipality only inside a configured region", () => {
    const municipal = makeBenefit({ level: "municipal", region: "CL", municipality: "47186" });
    expect(ids(selectQuestions([municipal], { region: "CL" }))).toContain("municipality");
    expect(ids(selectQuestions([municipal], { region: OUTSIDE_REGIONS }))).not.toContain(
      "municipality",
    );
  });
});
