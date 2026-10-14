import { describe, expect, it } from "vitest";
import { benefitSchema, lintRules, ruleGroupSchema } from "../src";
import { makeBenefit } from "./helpers";

describe("lintRules", () => {
  it("accepts a well-typed rule tree", () => {
    expect(
      lintRules({
        all: [
          { field: "applicantAge", op: "lte", value: 35, label: "a" },
          { field: "housing", op: "in", value: ["renting"], label: "b" },
          { field: "isLargeFamily", op: "eq", value: true, label: "c" },
          { field: "region", op: "eq", value: "CL", label: "d" },
          { op: "exists", field: "monthlyRent", label: "e" },
          {
            field: "annualHouseholdIncome",
            op: "lt",
            value: { mul: [3, { ref: "iprem14" }] },
            label: "f",
          },
        ],
        any: [{ field: "employmentStatus", op: "eq", value: "employed", label: "g" }],
      }),
    ).toEqual([]);
  });

  it("reports type mismatches with their path", () => {
    const errors = lintRules({
      all: [
        { field: "housing", op: "lt", value: 3, label: "a" },
        { field: "housing", op: "eq", value: "castle", label: "b" },
        { field: "isLargeFamily", op: "eq", value: "yes", label: "c" },
        { field: "applicantAge", op: "eq", value: "30", label: "d" },
        { field: "region", op: "eq", value: 3, label: "e" },
      ],
      any: [
        { field: "housing", op: "in", value: "renting", label: "f" },
        { field: "housing", op: "in", value: ["renting", "boat"], label: "g" },
        {} as never,
      ],
    });
    expect(errors).toHaveLength(8);
    expect(errors[0]).toContain("eligibility.all[0]");
    expect(errors.at(-1)).toContain("group needs");
  });
});

describe("schemas", () => {
  it("validates a complete benefit", () => {
    expect(benefitSchema.safeParse(makeBenefit()).success).toBe(true);
  });

  it("rejects unknown rule fields (e.g. invented by an LLM)", () => {
    const r = ruleGroupSchema.safeParse({
      all: [{ field: "favouriteColour", op: "eq", value: "x", label: "x" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty groups", () => {
    expect(ruleGroupSchema.safeParse({}).success).toBe(false);
  });

  it("accepts value expressions with known refs only", () => {
    const ok = ruleGroupSchema.safeParse({
      all: [
        {
          field: "annualHouseholdIncome",
          op: "lte",
          value: { mul: [2, { ref: "iprem14" }] },
          label: "x",
        },
      ],
    });
    const bad = ruleGroupSchema.safeParse({
      all: [
        {
          field: "annualHouseholdIncome",
          op: "lte",
          value: { mul: [2, { ref: "magic" }] },
          label: "x",
        },
      ],
    });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it("requires human review metadata for published benefits", () => {
    const r = benefitSchema.safeParse(makeBenefit({ reviewedBy: undefined }));
    expect(r.success).toBe(false);
  });

  it("allows drafts without review", () => {
    const r = benefitSchema.safeParse(
      makeBenefit({ status: "draft", reviewedBy: undefined, reviewedAt: undefined }),
    );
    expect(r.success).toBe(true);
  });

  it("requires region for regional benefits, municipality for municipal ones, window for calls", () => {
    expect(benefitSchema.safeParse(makeBenefit({ level: "regional" })).success).toBe(false);
    expect(benefitSchema.safeParse(makeBenefit({ level: "municipal", region: "CL" })).success).toBe(
      false,
    );
    expect(benefitSchema.safeParse(makeBenefit({ kind: "call" })).success).toBe(false);
  });
});
