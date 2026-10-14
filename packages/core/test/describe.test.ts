import { describe, expect, it } from "vitest";
import { describeRequirements } from "../src";

describe("describeRequirements", () => {
  it("lists leaf rules and any-groups as single items", () => {
    expect(
      describeRequirements({
        all: [
          { field: "applicantAge", op: "gte", value: 18, label: "Mayor de edad" },
          { all: [{ field: "housing", op: "eq", value: "renting", label: "Alquiler" }] },
          {
            any: [
              { field: "isLargeFamily", op: "eq", value: true, label: "Familia numerosa" },
              {
                all: [
                  { field: "isSingleParent", op: "eq", value: true, label: "Monoparental" },
                  { field: "numChildren", op: "gte", value: 2, label: "Dos hijos" },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual(["Mayor de edad", "Alquiler", "Familia numerosa o Monoparental y Dos hijos"]);
  });

  it("uses group labels and top-level any", () => {
    expect(
      describeRequirements({
        any: [
          { field: "isLargeFamily", op: "eq", value: true, label: "A" },
          { field: "isSingleParent", op: "eq", value: true, label: "B" },
        ],
        label: "Situación familiar especial",
      }),
    ).toEqual(["Situación familiar especial"]);
    expect(
      describeRequirements({
        any: [
          { field: "isLargeFamily", op: "eq", value: true, label: "A" },
          {
            any: [
              { field: "isSingleParent", op: "eq", value: true, label: "B" },
              { field: "isSingleParent", op: "eq", value: false, label: "C" },
            ],
          },
        ],
      }),
    ).toEqual(["A o B o C"]);
    expect(
      describeRequirements({
        all: [
          { any: [{ field: "isLargeFamily", op: "eq", value: true, label: "A" }], label: "Grupo" },
        ],
      }),
    ).toEqual(["Grupo"]);
  });
});
