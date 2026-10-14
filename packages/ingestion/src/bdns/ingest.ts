import type { Database } from "@tetoca/db";
import { findLatestDocument, saveSourceDocument } from "@tetoca/db";
import { pdfToText } from "../pdf";
import { htmlToText, sha256, stripBoilerplate } from "../text";
import { BdnsClient } from "./client";
import { BDNS_BENEFICIARY_INDIVIDUALS, type BdnsDetail, type BdnsSearchItem } from "./schemas";

/** Titles that are never benefits for households (direct grants to entities, prizes…). */
const EXCLUDED_TITLE_PATTERNS = [
  /concesi[oó]n directa/i,
  /\bpremios?\b/i,
  /\bbecas? de (formaci[oó]n|colaboraci[oó]n|investigaci[oó]n)/i,
  /\bconcurso\b/i,
];

const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

/**
 * Cheap pre-filter on search results: title patterns, and local calls only
 * from the municipalities enabled in the product.
 */
export function isCandidateForHouseholds(
  item: Pick<BdnsSearchItem, "descripcion"> & Partial<Pick<BdnsSearchItem, "nivel1" | "nivel2">>,
  allowedMunicipalities: string[] = [],
): boolean {
  if (EXCLUDED_TITLE_PATTERNS.some((re) => re.test(item.descripcion))) return false;
  if (item.nivel1 === "LOCAL") {
    const allowed = allowedMunicipalities.map(normalise);
    return allowed.includes(normalise(item.nivel2 ?? ""));
  }
  return true;
}

/** Calls also aimed at companies are not household benefits. */
export function targetsOnlyIndividuals(detail: Pick<BdnsDetail, "tiposBeneficiarios">): boolean {
  return !detail.tiposBeneficiarios.some((b) => /EMPRESA|PYME/i.test(b.descripcion ?? ""));
}

/** Documents worth reading: the call itself and its regulatory bases, as PDFs. */
const MAX_DOCUMENTS = 3;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function selectDocuments(detail: BdnsDetail) {
  return detail.documentos
    .filter((d) => (d.nombreFic ?? "").toLowerCase().endsWith(".pdf"))
    .filter((d) => (d.long ?? 0) <= MAX_DOCUMENT_BYTES)
    .sort((a, b) => {
      const score = (x: typeof a) => (/convocatoria|bases/i.test(x.descripcion ?? "") ? 0 : 1);
      return score(a) - score(b);
    })
    .slice(0, MAX_DOCUMENTS);
}

/** Plain-text document assembled from the call metadata, announcements and PDFs. */
export function buildDocumentText(detail: BdnsDetail, pdfTexts: { name: string; text: string }[]) {
  const header = [
    `# ${detail.descripcion}`,
    `Código BDNS: ${detail.codigoBDNS}`,
    `Órgano: ${[detail.organo.nivel1, detail.organo.nivel2, detail.organo.nivel3].filter(Boolean).join(" / ")}`,
    `Beneficiarios: ${detail.tiposBeneficiarios.map((b) => b.descripcion).join("; ")}`,
    `Regiones: ${detail.regiones.map((r) => r.descripcion).join("; ")}`,
    detail.fechaInicioSolicitud ? `Inicio de solicitudes: ${detail.fechaInicioSolicitud}` : null,
    detail.fechaFinSolicitud ? `Fin de solicitudes: ${detail.fechaFinSolicitud}` : null,
    detail.textInicio ? `Inicio (texto): ${detail.textInicio}` : null,
    detail.textFin ? `Fin (texto): ${detail.textFin}` : null,
    detail.presupuestoTotal ? `Presupuesto total: ${detail.presupuestoTotal} €` : null,
    detail.urlBasesReguladoras ? `Bases reguladoras: ${detail.urlBasesReguladoras}` : null,
    detail.sedeElectronica ? `Sede electrónica: ${detail.sedeElectronica.trim()}` : null,
  ].filter(Boolean);
  const announcements = detail.anuncios
    .filter((a) => a.texto)
    .map(
      (a) =>
        `## Anuncio: ${a.titulo ?? ""}\n${a.url ? `Fuente: ${a.url}\n` : ""}${htmlToText(a.texto!)}`,
    );
  const pdfs = pdfTexts.map((p) => `## Documento: ${p.name}\n${stripBoilerplate(p.text)}`);
  return [header.join("\n"), ...announcements, ...pdfs].join("\n\n").trim();
}

export type IngestOptions = {
  db: Database;
  client?: BdnsClient;
  /** BDNS region id, e.g. 29 for Castilla y León. */
  regionId: number;
  /** Only calls received from this date (YYYY-MM-DD). */
  since: string;
  /** Upper bound of calls processed per run (cost/politeness guard). */
  limit?: number;
  /** Municipality names whose local calls are ingested (BDNS `nivel2`). */
  municipalities?: string[];
  log?: (message: string) => void;
};

export type IngestResult = {
  seen: number;
  skipped: number;
  unchanged: number;
  created: { documentId: string; code: string; needsManualReview: boolean }[];
};

/**
 * Daily ingestion of BDNS calls for individuals in a region. Stores the
 * original text (plus hash and URL) for traceability; deduplicates by BDNS
 * code and content hash.
 */
export async function ingestBdns(options: IngestOptions): Promise<IngestResult> {
  const { db, regionId, since, limit = 200, municipalities = [], log = () => {} } = options;
  const client = options.client ?? new BdnsClient();
  const result: IngestResult = { seen: 0, skipped: 0, unchanged: 0, created: [] };

  for await (const item of client.searchAll({
    regions: [regionId],
    beneficiaryTypes: [BDNS_BENEFICIARY_INDIVIDUALS],
    from: since,
  })) {
    if (result.seen >= limit) break;
    result.seen++;
    if (!isCandidateForHouseholds(item, municipalities)) {
      result.skipped++;
      continue;
    }

    const detail = await client.getCall(item.numeroConvocatoria);
    if (!targetsOnlyIndividuals(detail)) {
      result.skipped++;
      continue;
    }
    const pdfTexts: { name: string; text: string }[] = [];
    let needsManualReview = false;
    for (const doc of selectDocuments(detail)) {
      try {
        const pdf = await pdfToText(await client.getDocument(doc.id));
        if (pdf.looksScanned) needsManualReview = true;
        else
          pdfTexts.push({
            name: doc.descripcion ?? doc.nombreFic ?? String(doc.id),
            text: pdf.text,
          });
      } catch (err) {
        needsManualReview = true;
        log(
          `! ${item.numeroConvocatoria}: could not read document ${doc.id}: ${(err as Error).message}`,
        );
      }
    }

    const text = buildDocumentText(detail, pdfTexts);
    const contentHash = sha256(text);
    const previous = await findLatestDocument(db, "bdns", detail.codigoBDNS);
    if (previous?.contentHash === contentHash) {
      result.unchanged++;
      continue;
    }

    const { document, created } = await saveSourceDocument(db, {
      source: "bdns",
      externalId: detail.codigoBDNS,
      url: BdnsClient.callUrl(detail.codigoBDNS),
      title: detail.descripcion,
      text,
      contentHash,
      mimeType: "text/plain",
      needsManualReview,
      metadata: detail as unknown as Record<string, unknown>,
    });
    if (!created) {
      result.unchanged++;
      continue;
    }
    log(`+ ${detail.codigoBDNS} ${detail.descripcion.slice(0, 80)}`);
    result.created.push({ documentId: document.id, code: detail.codigoBDNS, needsManualReview });
  }
  return result;
}
