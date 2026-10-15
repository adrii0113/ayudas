import {
  REGIONS,
  territoryAncestors,
  territoryFromNuts,
  ccaaByIso,
  territoryId,
} from "@tetoca/core";
import { BdnsClient } from "./client";
import {
  beneficiaryTypesFrom,
  editionStatusOf,
  normalizeName,
  programTypeFromTitle,
} from "./normalize";
import type { BdnsDetail } from "./schemas";

/**
 * Open BDNS calls for individuals, per autonomous community, shown on the web
 * as "sin verificar" (detected, not reviewed): title, organism, deadline and
 * the official link. Requirements are not evaluated.
 */
export type OpenCall = {
  bdnsCode: string;
  title: string;
  organism: string;
  opensAt: string | null;
  closesAt: string | null;
  windowText: string | null;
  url: string;
  publishedAt: string | null;
};

export type OpenCallsFile = {
  generatedAt: string;
  source: string;
  byRegion: Record<string, OpenCall[]>;
};

/** BDNS region ids (NUTS2 and its NUTS3 units) for each community, from GET /regiones. */
export async function bdnsRegionIdsByCommunity(
  client: BdnsClient,
): Promise<Record<string, number[]>> {
  const tree = await client.getRegions();
  const out: Record<string, number[]> = {};
  const walk = (nodes: { id: number; descripcion: string; children?: unknown[] }[]) => {
    for (const n of nodes) {
      const code = n.descripcion.split(" - ")[0]?.trim() ?? "";
      const id = territoryFromNuts(code);
      const ccaa = id ? territoryAncestors(id).find((t) => t.startsWith("ccaa:")) : undefined;
      if (ccaa) {
        const iso = REGIONS.find((r) => territoryId.region(ccaaByIso(r.code)!.ine) === ccaa)?.code;
        if (iso) (out[iso] ??= []).push(n.id);
      }
      if (n.children) walk(n.children as typeof nodes);
    }
  };
  walk(tree);
  return out;
}

const isoDay = (v: string | null | undefined) =>
  v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;

/**
 * BDNS spending purposes (GET /finalidades) relevant to households. Others
 * (agriculture and fishing, trade, industry, R&D…) are open to individuals
 * only as professionals and would be noise for families.
 */
export const HOUSEHOLD_PURPOSES = [
  "acceso a la vivienda y fomento de la edificacion",
  "desempleo",
  "fomento del empleo",
  "educacion",
  "sanidad",
  "servicios sociales y promocion social",
  "otras prestaciones economicas",
  "subvenciones al transporte",
];

/** Whether a call should be listed as open on `today`. */
export function isListable(detail: BdnsDetail, today: string, recentSince: string): boolean {
  if (programTypeFromTitle(detail.descripcion) === "prize") return false;
  if (!HOUSEHOLD_PURPOSES.includes(normalizeName(detail.descripcionFinalidad ?? ""))) return false;
  if (!beneficiaryTypesFrom(detail.tiposBeneficiarios).includes("individuals")) return false;
  const status = editionStatusOf(detail, today);
  if (status === "open" || status === "announced") return true;
  // Undated windows ("15 días hábiles desde la publicación"): only recent ones.
  return status === "unknown" && (isoDay(detail.fechaRecepcion) ?? "") >= recentSince;
}

export function toOpenCall(detail: BdnsDetail): OpenCall {
  const o = detail.organo;
  return {
    bdnsCode: detail.codigoBDNS,
    title: detail.descripcion.trim(),
    organism: (o.nivel3 || o.nivel2 || o.nivel1 || "").trim(),
    opensAt: isoDay(detail.fechaInicioSolicitud),
    closesAt: isoDay(detail.fechaFinSolicitud),
    windowText: [detail.textInicio, detail.textFin].filter(Boolean).join(" — ") || null,
    url: detail.sedeElectronica || BdnsClient.callUrl(detail.codigoBDNS),
    publishedAt: isoDay(detail.fechaRecepcion),
  };
}

/**
 * Collects open calls of each community's government for individuals,
 * published in the last `sinceDays` days (at most `perRegion` details each).
 */
export async function collectOpenCalls(opts: {
  client: BdnsClient;
  today: string;
  sinceDays?: number;
  perRegion?: number;
  log?: (m: string) => void;
}): Promise<OpenCallsFile> {
  const { client, today } = opts;
  const since = new Date(Date.parse(today) - (opts.sinceDays ?? 120) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recentSince = new Date(Date.parse(today) - 45 * 86_400_000).toISOString().slice(0, 10);
  const regionIds = await bdnsRegionIdsByCommunity(client);
  const byRegion: Record<string, OpenCall[]> = {};
  for (const region of REGIONS) {
    const ids = regionIds[region.code];
    if (!ids?.length) continue;
    const calls: OpenCall[] = [];
    let checked = 0;
    for await (const item of client.searchAll({
      regions: ids,
      beneficiaryTypes: [1],
      administrationType: "A",
      from: since,
      pageSize: 50,
    })) {
      if (checked >= (opts.perRegion ?? 40)) break;
      if (programTypeFromTitle(item.descripcion) === "prize") continue;
      checked++;
      try {
        const detail = await client.getCall(item.numeroConvocatoria);
        if (isListable(detail, today, recentSince)) calls.push(toOpenCall(detail));
      } catch (err) {
        opts.log?.(`✗ ${item.numeroConvocatoria}: ${(err as Error).message}`);
      }
    }
    // Soonest deadline first; undated last.
    calls.sort((a, b) => (a.closesAt ?? "9999").localeCompare(b.closesAt ?? "9999"));
    byRegion[region.code] = calls;
    opts.log?.(`${region.name}: ${calls.length} open of ${checked} checked`);
  }
  return {
    generatedAt: today,
    source: "Base de Datos Nacional de Subvenciones (BDNS), infosubvenciones.es",
    byRegion,
  };
}
