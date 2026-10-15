import { listSourceDocuments, type Database } from "@tetoca/db";
import { createTestDb } from "@tetoca/db/testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BdnsClient,
  bdnsDetailSchema,
  buildDocumentText,
  htmlToText,
  ingestBdns,
  isCandidateForHouseholds,
  selectDocuments,
  stripBoilerplate,
  targetsOnlyIndividuals,
} from "../src";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"));
const searchFixture = fixture("bdns-search.json");
const detailFixture = fixture("bdns-detail-932041.json");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const noSleep = async () => {};

describe("BdnsClient", () => {
  it("builds documented query parameters (dd/mm/yyyy dates, comma lists)", async () => {
    const fetchMock = vi.fn(async (_url: string) => json(searchFixture));
    const client = new BdnsClient({
      fetch: fetchMock as typeof fetch,
      minIntervalMs: 0,
      sleep: noSleep,
    });
    const page = await client.search({
      regions: [29],
      beneficiaryTypes: [1],
      from: "2026-09-01",
      text: "alquiler",
    });
    expect(page.content[0]?.numeroConvocatoria).toBe("932041");
    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.pathname).toBe("/bdnstrans/api/convocatorias/busqueda");
    expect(url.searchParams.get("regiones")).toBe("29");
    expect(url.searchParams.get("tiposBeneficiario")).toBe("1");
    expect(url.searchParams.get("fechaDesde")).toBe("01/09/2026");
    expect(url.searchParams.get("descripcion")).toBe("alquiler");
    expect(url.searchParams.get("vpd")).toBe("GE");
  });

  it("retries on 5xx/429 and fails fast on 4xx", async () => {
    const flaky = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(json(detailFixture));
    const client = new BdnsClient({
      fetch: flaky as typeof fetch,
      minIntervalMs: 0,
      sleep: noSleep,
    });
    expect((await client.getCall("932041")).codigoBDNS).toBe("932041");
    expect(flaky).toHaveBeenCalledTimes(2);

    const notFound = vi.fn(async () => new Response("", { status: 404 }));
    const client2 = new BdnsClient({
      fetch: notFound as typeof fetch,
      minIntervalMs: 0,
      sleep: noSleep,
    });
    await expect(client2.getCall("x")).rejects.toThrow(/HTTP 404/);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("waits between requests (rate limit)", async () => {
    const sleep = vi.fn(noSleep);
    const client = new BdnsClient({
      fetch: (async () => json(detailFixture)) as typeof fetch,
      minIntervalMs: 60_000,
      sleep,
    });
    await client.getCall("1");
    await client.getCall("2");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("paginates until the last page", async () => {
    const pages = [
      { ...searchFixture, last: false, number: 0 },
      { ...searchFixture, last: true, number: 1 },
    ];
    let i = 0;
    const client = new BdnsClient({
      fetch: (async () => json(pages[i++])) as typeof fetch,
      minIntervalMs: 0,
      sleep: noSleep,
    });
    const items = [];
    for await (const item of client.searchAll({ regions: [29] })) items.push(item);
    expect(items).toHaveLength(searchFixture.content.length * 2);
  });
});

describe("document text", () => {
  const detail = bdnsDetailSchema.parse(detailFixture);

  it("filters out non-household calls", () => {
    expect(
      isCandidateForHouseholds({
        descripcion: "Acuerdo por el que se autoriza la concesión directa de una subvención a X",
      }),
    ).toBe(false);
    expect(
      isCandidateForHouseholds({ descripcion: "Premios Extraordinarios de Bachillerato" }),
    ).toBe(false);
    expect(isCandidateForHouseholds({ descripcion: detail.descripcion })).toBe(true);
  });

  it("keeps local calls only from enabled municipalities", () => {
    const local = { descripcion: "Ayudas material escolar", nivel1: "LOCAL" };
    expect(isCandidateForHouseholds({ ...local, nivel2: "GARCILLÁN" }, ["Valladolid"])).toBe(false);
    expect(isCandidateForHouseholds({ ...local, nivel2: "VALLADOLID" }, ["Valladolid"])).toBe(true);
    expect(isCandidateForHouseholds({ ...local, nivel2: "VALLADOLID" })).toBe(false);
  });

  it("drops calls also aimed at companies", () => {
    expect(targetsOnlyIndividuals(detail)).toBe(true);
    expect(
      targetsOnlyIndividuals({
        tiposBeneficiarios: [
          { descripcion: "GRAN EMPRESA" },
          { descripcion: "PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA" },
        ],
      }),
    ).toBe(false);
  });

  it("builds a traceable text with metadata and announcements", () => {
    const text = buildDocumentText(detail, [{ name: "Bases", text: "Texto de las bases" }]);
    expect(text).toContain("Código BDNS: 932041");
    expect(text).toContain("Fin de solicitudes: 2027-01-15");
    expect(text).toContain("La cuantía máxima de la subvención a conceder será de 900,00 euros");
    expect(text).toContain("## Documento: Bases");
    expect(text).not.toMatch(/<p>/);
  });

  it("prefers the call and bases PDFs", () => {
    expect(selectDocuments(detail).map((d) => d.id)).toEqual([1528255, 1528234]);
  });

  it("converts HTML and strips signature boilerplate", () => {
    expect(htmlToText("<p>Hola&nbsp;<b>mundo</b></p><p>A &amp; B</p>")).toBe("Hola mundo\nA & B");
    expect(htmlToText("<p>categor&iacute;a 1&ordf; &euro; &#233;&#xF1; &bogus;</p>")).toBe(
      "categoría 1ª € éñ &bogus;",
    );
    expect(stripBoilerplate("Texto\nFecha Firma: 20/02/2026\nFirmado: X\nMás texto")).toBe(
      "Texto\nMás texto",
    );
  });
});

describe("ingestBdns", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
  });

  function fakeClient() {
    const search = { ...searchFixture, content: searchFixture.content.slice(0, 2), last: true };
    const conflict = {
      ...searchFixture.content[1],
      descripcion: "Acuerdo de concesión directa a una fundación",
    };
    search.content = [searchFixture.content[0], conflict];
    return new BdnsClient({
      minIntervalMs: 0,
      sleep: noSleep,
      fetch: (async (input: string) => {
        const url = String(input);
        if (url.includes("/convocatorias/busqueda")) return json(search);
        if (url.includes("/convocatorias/documentos")) return new Response("not a pdf");
        return json(detailFixture);
      }) as typeof fetch,
    });
  }

  it("stores new calls once and skips unchanged ones on the next run", async () => {
    const first = await ingestBdns({ db, client: fakeClient(), regionId: 29, since: "2026-09-01" });
    expect(first).toMatchObject({ seen: 2, skipped: 1, unchanged: 0 });
    expect(first.created).toHaveLength(1);
    // Unreadable PDFs are flagged for manual review (no OCR in the MVP).
    expect(first.created[0]?.needsManualReview).toBe(true);

    const docs = await listSourceDocuments(db);
    expect(docs[0]).toMatchObject({ source: "bdns", externalId: "932041" });
    expect(docs[0]?.url).toBe(
      "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/932041",
    );
    expect(docs[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const second = await ingestBdns({
      db,
      client: fakeClient(),
      regionId: 29,
      since: "2026-09-01",
    });
    expect(second.created).toHaveLength(0);
    expect(second.unchanged).toBe(1);
  });

  it("respects the per-run limit", async () => {
    const r = await ingestBdns({
      db,
      client: fakeClient(),
      regionId: 29,
      since: "2026-09-01",
      limit: 1,
    });
    expect(r.seen).toBe(1);
  });
});
