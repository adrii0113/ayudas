import { describe, expect, it } from "vitest";
import {
  AUTONOMOUS_COMMUNITIES,
  PROVINCES,
  ccaaByIso,
  fiscalRegimeOf,
  provinceOfMunicipality,
  territoryAncestors,
  territoryFromNuts,
} from "../src/territory";

describe("territory reference data", () => {
  it("has 19 autonomous communities/cities and 52 provinces with unique codes", () => {
    expect(AUTONOMOUS_COMMUNITIES).toHaveLength(19);
    expect(PROVINCES).toHaveLength(52);
    expect(new Set(PROVINCES.map((p) => p.ine)).size).toBe(52);
    expect(new Set(PROVINCES.flatMap((p) => p.nuts3)).size).toBe(59);
    for (const p of PROVINCES) {
      expect(AUTONOMOUS_COMMUNITIES.some((c) => c.ine === p.ccaaIne)).toBe(true);
    }
  });

  it("maps ISO and NUTS codes", () => {
    expect(ccaaByIso("CL")?.ine).toBe("07");
    expect(territoryFromNuts("ES")).toBe("es");
    expect(territoryFromNuts("ES41")).toBe("ccaa:07");
    expect(territoryFromNuts("ES418")).toBe("prov:47");
    expect(territoryFromNuts("ES709")).toBe("prov:38");
    expect(territoryFromNuts("ES4")).toBeUndefined();
    expect(territoryFromNuts("FR1")).toBeUndefined();
  });

  it("walks up the hierarchy", () => {
    expect(provinceOfMunicipality("47186")?.name).toBe("Valladolid");
    expect(territoryAncestors("mun:47186")).toEqual(["mun:47186", "prov:47", "ccaa:07", "es"]);
    expect(territoryAncestors("ccaa:07")).toEqual(["ccaa:07", "es"]);
    expect(territoryAncestors("es")).toEqual(["es"]);
  });

  it("knows the foral fiscal regime", () => {
    expect(fiscalRegimeOf("mun:48020")).toBe("foral"); // Bilbao
    expect(fiscalRegimeOf("prov:31")).toBe("foral");
    expect(fiscalRegimeOf("mun:47186")).toBe("common");
    expect(fiscalRegimeOf("es")).toBeUndefined();
  });
});
