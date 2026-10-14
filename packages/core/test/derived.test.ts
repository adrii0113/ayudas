import { describe, expect, it } from "vitest";
import { resolveField, type HouseholdProfile } from "../src";

const p = (profile: Partial<HouseholdProfile>): HouseholdProfile => ({ region: "CL", ...profile });

describe("derived fields", () => {
  const family = p({
    householdSize: 4,
    annualHouseholdIncome: 30000,
    children: [
      { age: 2, disabilityPercent: 0 },
      { age: 19, disabilityPercent: 40 },
    ],
  });

  it("counts children, minors and disability", () => {
    expect(resolveField(family, "numChildren")).toBe(2);
    expect(resolveField(family, "numMinors")).toBe(1);
    expect(resolveField(family, "numChildrenWithDisability")).toBe(1);
  });

  it("computes youngest / oldest child age", () => {
    expect(resolveField(family, "youngestChildAge")).toBe(2);
    expect(resolveField(family, "oldestChildAge")).toBe(19);
  });

  it("computes adults: household size minus minors", () => {
    expect(resolveField(family, "numAdults")).toBe(3);
    expect(resolveField(family, "extraAdults")).toBe(2);
  });

  it("computes income per capita", () => {
    expect(resolveField(family, "incomePerCapita")).toBe(7500);
  });

  it("returns null (not applicable) for child ages without children", () => {
    const none = p({ children: [] });
    expect(resolveField(none, "youngestChildAge")).toBeNull();
    expect(resolveField(none, "oldestChildAge")).toBeNull();
    expect(resolveField(none, "numChildren")).toBe(0);
  });

  it("returns undefined (unknown) when the base data is missing", () => {
    const empty = p({});
    for (const f of [
      "numChildren",
      "numMinors",
      "youngestChildAge",
      "oldestChildAge",
      "numChildrenWithDisability",
      "numAdults",
      "extraAdults",
      "incomePerCapita",
    ] as const) {
      expect(resolveField(empty, f)).toBeUndefined();
    }
  });

  it("never reports less than one adult", () => {
    expect(resolveField(p({ householdSize: 1, children: [{ age: 3 }] }), "numAdults")).toBe(1);
  });

  it("is unknown about disability if a child's disability was not answered", () => {
    expect(
      resolveField(p({ children: [{ age: 3 }] }), "numChildrenWithDisability"),
    ).toBeUndefined();
    // ...unless another child already has a recognised disability.
    expect(
      resolveField(
        p({ children: [{ age: 3 }, { age: 5, disabilityPercent: 33 }] }),
        "numChildrenWithDisability",
      ),
    ).toBe(1);
  });

  it("returns array fields as their length and plain fields as is", () => {
    expect(resolveField(family, "children")).toBe(2);
    expect(resolveField(family, "region")).toBe("CL");
  });
});
