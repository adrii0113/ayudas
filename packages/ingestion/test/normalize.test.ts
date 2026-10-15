import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beneficiaryTypesFrom,
  bdnsDetailSchema,
  buildMunicipalityIndex,
  callFromDetail,
  ccaaFromName,
  commonTerritory,
  nameVariants,
  programTypeFromTitle,
  resolveOrganism,
  territoriesFromRegions,
} from "../src";

const index = buildMunicipalityIndex([
  { ine: "41081", name: "Rinconada, La", provinceIne: "41" },
  { ine: "01057", name: "Villabuena de Álava/Eskuernaga", provinceIne: "01" },
  { ine: "36013", name: "Covelo", provinceIne: "36" },
  { ine: "17105", name: "Mieres", provinceIne: "17" },
  { ine: "33037", name: "Mieres", provinceIne: "33" },
  { ine: "47186", name: "Valladolid", provinceIne: "47" },
  { ine: "18087", name: "Granada", provinceIne: "18" },
  { ine: "08094", name: "Granada, La", provinceIne: "08" },
  { ine: "46132", name: "Genovés, el", provinceIne: "46" },
  { ine: "31088", name: "Valle de Elorz/Elortzibar", provinceIne: "31" },
]);

describe("BDNS normalisation", () => {
  it("produces comparable name variants", () => {
    expect(nameVariants("RINCONADA, LA")).toEqual(["la rinconada"]);
    expect(nameVariants("Rinconada, La")).toEqual(["la rinconada"]);
    expect(nameVariants("Villabuena de Álava/Eskuernaga")).toEqual([
      "villabuena de alava",
      "eskuernaga",
    ]);
  });

  it("maps BDNS regions (NUTS) to territories and finds the common one", () => {
    const ids = territoriesFromRegions([
      { descripcion: "ES114 - Pontevedra" },
      { descripcion: "ES111 - A Coruña" },
      { descripcion: "ES1 - NOROESTE" },
    ]);
    expect(ids).toEqual(["prov:15", "prov:36"]);
    expect(commonTerritory(ids)).toBe("ccaa:12");
    expect(commonTerritory(["prov:36"])).toBe("prov:36");
    expect(commonTerritory([])).toBe("es");
  });

  it("resolves organisms of every administration level", () => {
    expect(
      resolveOrganism({ nivel1: "ESTADO", nivel2: "MINISTERIO X", nivel3: "SEPE" }, [], index),
    ).toMatchObject({
      adminLevel: "state",
      territoryId: "es",
      name: "SEPE",
      parentName: "MINISTERIO X",
    });
    expect(
      resolveOrganism({ nivel1: "AUTONOMICA", nivel2: "PAÍS VASCO", nivel3: "DPTO" }, [], index),
    ).toMatchObject({ adminLevel: "regional", territoryId: "ccaa:16" });
    expect(
      resolveOrganism(
        { nivel1: "LOCAL", nivel2: "RINCONADA, LA", nivel3: "AYUNTAMIENTO DE LA RINCONADA" },
        ["prov:41"],
        index,
      ),
    ).toMatchObject({ adminLevel: "municipal", territoryId: "mun:41081" });
    // Ambiguous name: the call's province decides.
    expect(
      resolveOrganism(
        { nivel1: "LOCAL", nivel2: "MIERES", nivel3: "AYUNTAMIENTO DE MIERES" },
        ["prov:33"],
        index,
      ).territoryId,
    ).toBe("mun:33037");
    expect(
      resolveOrganism(
        { nivel1: "LOCAL", nivel2: "MIERES", nivel3: "AYUNTAMIENTO DE MIERES" },
        [],
        index,
      ).territoryId,
    ).toBe("es");
    expect(
      resolveOrganism(
        {
          nivel1: "LOCAL",
          nivel2: "DIPUTACIÓN PROV. DE LLEIDA",
          nivel3: "DIPUTACIÓN PROV. DE LLEIDA",
        },
        ["prov:25"],
        index,
      ),
    ).toMatchObject({ adminLevel: "provincial", territoryId: "prov:25" });
    expect(
      resolveOrganism(
        { nivel1: "OTROS", nivel2: "UNIVERSIDAD DE LEÓN", nivel3: null },
        ["prov:24"],
        index,
      ),
    ).toMatchObject({ adminLevel: "other", territoryId: "prov:24", parentName: null });
  });

  it("prefers exact names, then article-less ones, then curated aliases", () => {
    const mun = (n2: string, regions: string[] = []) =>
      resolveOrganism(
        { nivel1: "LOCAL", nivel2: n2, nivel3: `AYUNTAMIENTO DE ${n2}` },
        regions,
        index,
      ).territoryId;
    expect(mun("GRANADA")).toBe("mun:18087");
    expect(mun("GRANADA, LA")).toBe("mun:08094");
    expect(mun("GENOVÉS")).toBe("mun:46132");
    expect(mun("MIERES (ASTURIAS)", ["prov:33"])).toBe("mun:33037");
    expect(mun("NOÁIN (VALLE DE ELORZ)/NOAIN (ELORTZIBAR)")).toBe("mun:31088");
  });

  it("classifies provincial and supramunicipal bodies", () => {
    const org = (n2: string, n3: string) =>
      resolveOrganism({ nivel1: "LOCAL", nivel2: n2, nivel3: n3 }, [], index);
    expect(org("DIPUTACIÓN PROV. DE ZAMORA", "PATRONATO PROVINCIAL DE TURISMO")).toMatchObject({
      adminLevel: "provincial",
      territoryId: "prov:49",
    });
    expect(org("CABILDO INSULAR DE TENERIFE", "IASS")).toMatchObject({ territoryId: "prov:38" });
    expect(org("CONSEJO INSULAR DE MALLORCA", "DEPARTAMENTO X")).toMatchObject({
      territoryId: "prov:07",
    });
    expect(org("COMARCA DE SOBRARBE", "COMARCA DE SOBRARBE").adminLevel).toBe("other");
    expect(
      org("JESÚS POBRE, ENTIDAD LOCAL MENOR", "JESÚS POBRE, ENTIDAD LOCAL MENOR").adminLevel,
    ).toBe("other");
  });

  it("knows CCAA names as written by the BDNS", () => {
    expect(ccaaFromName("CASTILLA Y LEÓN")).toBe("07");
    expect(ccaaFromName("COMUNIDAD VALENCIANA")).toBe("10");
    expect(ccaaFromName("CIUDAD AUTÓNOMA DE CEUTA")).toBe("18");
    expect(ccaaFromName("ATLANTIS")).toBeUndefined();
  });

  it("maps beneficiary types and detects prizes", () => {
    expect(
      beneficiaryTypesFrom([
        { descripcion: "PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA" },
        { descripcion: "PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA" },
        { descripcion: null },
      ]),
    ).toEqual(["individuals", "smes_and_self_employed", "unspecified"]);
    expect(programTypeFromTitle("XVI CONCURSO CARTEL EN FIRA 2027")).toBe("prize");
    expect(programTypeFromTitle("Premios extraordinarios de Bachillerato")).toBe("prize");
    expect(programTypeFromTitle("Ayudas a la natalidad 2026")).toBe("grant_call");
  });

  it("builds a detected call from a real BDNS detail", () => {
    const detail = bdnsDetailSchema.parse(
      JSON.parse(
        readFileSync(join(import.meta.dirname, "fixtures", "bdns-detail-932041.json"), "utf8"),
      ),
    );
    const call = callFromDetail(detail, index, "2026-10-15");
    expect(call.bdnsCode).toBe(detail.codigoBDNS);
    expect(call.organism.adminLevel).toBe("regional");
    expect(call.organism.territoryId).toBe("ccaa:07");
    expect(call.detail?.beneficiaryTypes).toContain("individuals");
    expect(call.detail?.raw).toBe(detail);
  });
});
