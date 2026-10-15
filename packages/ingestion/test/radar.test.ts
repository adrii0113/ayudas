import {
  buildTerritoryRows,
  getEditionByBdnsCode,
  getProgramBySlug,
  registryStats,
  seedTerritories,
} from "@tetoca/db";
import { createTestDb } from "@tetoca/db/testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bdnsDetailSchema,
  buildMunicipalityIndex,
  runBdnsRadar,
  scopeTerritory,
  type BdnsClient,
  type BdnsDetail,
  type BdnsSearchItem,
} from "../src";

const baseDetail = bdnsDetailSchema.parse(
  JSON.parse(
    readFileSync(join(import.meta.dirname, "fixtures", "bdns-detail-932041.json"), "utf8"),
  ),
);

const municipalities = [{ ine: "36013", name: "Covelo", provinceIne: "36" }];
const index = buildMunicipalityIndex(municipalities);

const items: BdnsSearchItem[] = [
  {
    id: 1,
    numeroConvocatoria: "900001",
    descripcion: "Ayudas al estudio 2026",
    fechaRecepcion: "2026-10-01T10:00:00",
    nivel1: "LOCAL",
    nivel2: "COVELO",
    nivel3: "AYUNTAMIENTO DE COVELO",
  },
  {
    id: 2,
    numeroConvocatoria: "900002",
    descripcion: "Premios de fotografía 2026",
    fechaRecepcion: "2026-10-02T10:00:00",
    nivel1: "AUTONOMICA",
    nivel2: "CASTILLA Y LEÓN",
    nivel3: "CONSEJERÍA DE CULTURA",
  },
];

function fakeClient(details: Record<string, BdnsDetail>): BdnsClient {
  return {
    async *searchAll() {
      yield* items;
    },
    async getCall(code: string) {
      const d = details[code];
      if (!d) throw new Error(`HTTP 404 for ${code}`);
      return d;
    },
  } as unknown as BdnsClient;
}

const detailFor = (code: string, patch: Partial<BdnsDetail> = {}): BdnsDetail => ({
  ...baseDetail,
  codigoBDNS: code,
  descripcion: items.find((i) => i.numeroConvocatoria === code)!.descripcion,
  ...patch,
});

describe("BDNS radar", () => {
  it("registers every listed call, then completes details", async () => {
    const db = await createTestDb();
    await seedTerritories(db, buildTerritoryRows(municipalities));
    const details = {
      "900001": detailFor("900001", {
        organo: { nivel1: "LOCAL", nivel2: "COVELO", nivel3: "AYUNTAMIENTO DE COVELO" },
        regiones: [{ descripcion: "ES114 - Pontevedra" }],
        fechaInicioSolicitud: "2026-10-01",
        fechaFinSolicitud: "2026-10-31",
        sedeElectronica: null,
      }),
    };
    const result = await runBdnsRadar({
      db,
      client: fakeClient(details),
      municipalities: index,
      from: "2026-10-01",
      today: "2026-10-15",
    });
    expect(result).toMatchObject({ listed: 2, created: 2, detailed: 1 });
    expect(result.errors).toEqual([{ bdnsCode: "900002", message: "HTTP 404 for 900002" }]);

    const program = await getProgramBySlug(db, "bdns-900001");
    expect(program).toMatchObject({
      trustLevel: "detected",
      adminLevel: "municipal",
      territoryId: "mun:36013",
      type: "grant_call",
    });
    const edition = await getEditionByBdnsCode(db, "900001");
    expect(edition).toMatchObject({
      status: "open",
      closesAt: "2026-10-31",
      officialUrl: "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/900001",
      territoryIds: ["prov:36"],
    });
    const prize = await getProgramBySlug(db, "bdns-900002");
    expect(prize).toMatchObject({ type: "prize", territoryId: "ccaa:07", adminLevel: "regional" });
    expect(await registryStats(db)).toMatchObject({ programs: 2, editions: 2, withoutDetail: 1 });
  });

  it("is idempotent and reports changes in the source", async () => {
    const db = await createTestDb();
    const details = { "900001": detailFor("900001"), "900002": detailFor("900002") };
    const client = fakeClient(details);
    await runBdnsRadar({
      db,
      client,
      municipalities: index,
      from: "2026-10-01",
      today: "2026-10-15",
    });
    const again = await runBdnsRadar({
      db,
      client,
      municipalities: index,
      from: "2026-10-01",
      today: "2026-10-15",
    });
    expect(again).toMatchObject({ listed: 2, created: 0, detailed: 0 });

    details["900001"] = detailFor("900001", { fechaFinSolicitud: "2027-01-31" });
    const refreshed = await runBdnsRadar({
      db,
      client,
      municipalities: index,
      refreshBefore: new Date(Date.now() + 60_000),
      today: "2026-10-15",
    });
    expect(refreshed.sourceChanged).toEqual(["900001"]);
    const edition = await getEditionByBdnsCode(db, "900001");
    expect(edition?.closesAt).toBe("2027-01-31");
  });

  it("scopes a call to the narrowest consistent territory", () => {
    const call = {
      bdnsCode: "1",
      title: "x",
      publishedAt: null,
      programType: "grant_call" as const,
      organism: {
        adminLevel: "regional" as const,
        sourceKey: "k",
        name: "n",
        parentName: null,
        territoryId: "ccaa:07",
      },
    };
    expect(scopeTerritory(call)).toBe("ccaa:07");
    const withDetail = (territoryIds: string[]) =>
      scopeTerritory({ ...call, detail: { territoryIds } as never });
    expect(withDetail(["prov:47"])).toBe("prov:47");
    expect(withDetail(["prov:28"])).toBe("ccaa:07");
    expect(withDetail([])).toBe("ccaa:07");
  });
});
