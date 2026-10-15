import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bdnsDetailSchema,
  bdnsRegionIdsByCommunity,
  isListable,
  toOpenCall,
  type BdnsClient,
} from "../src";

const detail = bdnsDetailSchema.parse(
  JSON.parse(
    readFileSync(join(import.meta.dirname, "fixtures", "bdns-detail-932041.json"), "utf8"),
  ),
);

describe("open calls", () => {
  it("lists open calls for individuals and skips closed ones and prizes", () => {
    const open = {
      ...detail,
      fechaInicioSolicitud: "2026-10-01",
      fechaFinSolicitud: "2026-12-31",
      descripcionFinalidad: "Educación",
    };
    expect(isListable(open, "2026-10-15", "2026-09-01")).toBe(true);
    expect(
      isListable({ ...open, fechaFinSolicitud: "2026-10-01" }, "2026-10-15", "2026-09-01"),
    ).toBe(false);
    expect(
      isListable(
        { ...open, descripcion: "Premios de fotografía 2026" },
        "2026-10-15",
        "2026-09-01",
      ),
    ).toBe(false);
    expect(
      isListable(
        { ...open, tiposBeneficiarios: [{ descripcion: "GRAN EMPRESA" }] },
        "2026-10-15",
        "2026-09-01",
      ),
    ).toBe(false);
  });

  it("skips purposes unrelated to households", () => {
    const fishing = {
      ...detail,
      fechaInicioSolicitud: "2026-10-01",
      fechaFinSolicitud: "2026-12-31",
      descripcionFinalidad: "Agricultura, pesca y alimentación",
    };
    expect(isListable(fishing, "2026-10-15", "2026-09-01")).toBe(false);
  });

  it("keeps undated calls only while recent", () => {
    const undated = {
      ...detail,
      fechaInicioSolicitud: null,
      fechaFinSolicitud: null,
      descripcionFinalidad: "Servicios sociales y promoción social",
    };
    expect(
      isListable({ ...undated, fechaRecepcion: "2026-10-01" }, "2026-10-15", "2026-09-01"),
    ).toBe(true);
    expect(
      isListable({ ...undated, fechaRecepcion: "2026-06-01" }, "2026-10-15", "2026-09-01"),
    ).toBe(false);
  });

  it("builds a public summary with an official link", () => {
    const call = toOpenCall({ ...detail, sedeElectronica: null });
    expect(call.url).toBe(
      `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${detail.codigoBDNS}`,
    );
    expect(call.organism).toBeTruthy();
  });

  it("maps the BDNS region tree to communities", async () => {
    const client = {
      getRegions: async () => [
        {
          id: 1,
          descripcion: "ES - ESPAÑA",
          children: [
            {
              id: 29,
              descripcion: "ES41 - CASTILLA Y LEON",
              children: [{ id: 37, descripcion: "ES418 - Valladolid" }],
            },
            { id: 87, descripcion: "ESZ - EXTRA-REGIO NUTS 1" },
          ],
        },
      ],
    } as unknown as BdnsClient;
    expect(await bdnsRegionIdsByCommunity(client)).toEqual({ CL: [29, 37] });
  });
});
