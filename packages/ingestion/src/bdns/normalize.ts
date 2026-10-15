import {
  AUTONOMOUS_COMMUNITIES,
  PROVINCES,
  editionStatus,
  territoryAncestors,
  territoryFromNuts,
  territoryId,
  type AdminLevel,
  type BeneficiaryType,
  type EditionStatus,
  type ProgramType,
} from "@tetoca/core";
import { MUNICIPALITY_ALIASES } from "./municipality-aliases";
import type { BdnsDetail, BdnsSearchItem } from "./schemas";

/**
 * Pure normalisation of BDNS records into registry fields: organism, territory,
 * beneficiary types, program type and edition window. No I/O here.
 */

/** Lowercase, no accents, no punctuation, single spaces. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ/,' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTICLES = /^(.*), (el|la|los|las|l'|lo|o|a|os|as|es|sa|ses|els|les|en|na)$/;

/** All comparable spellings: bilingual "A/B" parts and "Rinconada, La" ↔ "La Rinconada". */
const LEADING_ARTICLE = /^(el|la|los|las|l'|lo|o|a|os|as|es|sa|ses|els|les|en|na) ?/;

export function nameVariants(value: string): string[] {
  const out = new Set<string>();
  const withoutNotes = value.replace(/\([^)]*\)/g, " ");
  for (const part of normalizeName(withoutNotes).split("/")) {
    const p = part.trim();
    if (!p) continue;
    const m = ARTICLES.exec(p);
    const moved = (m ? `${m[2]}${m[2]!.endsWith("'") ? "" : " "}${m[1]}` : p)
      .replace(/,/g, "")
      .replace(/\s+/g, " ")
      .trim();
    out.add(moved);
  }
  return [...out];
}

/** Variants without a leading article ("Genovés, el" is often written "Genovés"). */
export function bareVariants(value: string): string[] {
  return nameVariants(value)
    .map((v) => v.replace(LEADING_ARTICLE, "").trim())
    .filter(Boolean);
}

type NameIndex = Map<string, Map<string, Set<string>>>;

/** Exact and article-less name variants, each: province INE → variant → INE codes. */
export type MunicipalityIndex = { exact: NameIndex; bare: NameIndex };

function addTo(index: NameIndex, province: string, variant: string, ine: string) {
  let byName = index.get(province);
  if (!byName) index.set(province, (byName = new Map()));
  let codes = byName.get(variant);
  if (!codes) byName.set(variant, (codes = new Set()));
  codes.add(ine);
}

export function buildMunicipalityIndex(
  municipalities: { ine: string; name: string; provinceIne: string }[],
): MunicipalityIndex {
  const index: MunicipalityIndex = { exact: new Map(), bare: new Map() };
  const known = new Set<string>();
  for (const m of municipalities) {
    known.add(m.ine);
    for (const v of nameVariants(m.name)) addTo(index.exact, m.provinceIne, v, m.ine);
    for (const v of bareVariants(m.name)) addTo(index.bare, m.provinceIne, v, m.ine);
  }
  for (const a of MUNICIPALITY_ALIASES) {
    if (!known.has(a.ine)) continue;
    for (const v of nameVariants(a.name)) addTo(index.exact, a.ine.slice(0, 2), v, a.ine);
  }
  return index;
}

/** Unique municipality for any of the variants, within `provinces` or nationally. */
function lookup(index: NameIndex, variants: string[], provinces?: string[]): string | undefined {
  const hits = new Set<string>();
  for (const [prov, byName] of index) {
    if (provinces && !provinces.includes(prov)) continue;
    for (const v of variants) for (const ine of byName.get(v) ?? []) hits.add(ine);
  }
  return hits.size === 1 ? [...hits][0] : undefined;
}

function findMunicipality(
  index: MunicipalityIndex,
  name: string,
  provinces: string[],
): string | undefined {
  const exact = nameVariants(name);
  const bare = bareVariants(name);
  // Exact spelling before article-less; the call's provinces before the whole country.
  return (
    (provinces.length ? lookup(index.exact, exact, provinces) : undefined) ??
    lookup(index.exact, exact) ??
    (provinces.length ? lookup(index.bare, bare, provinces) : undefined) ??
    lookup(index.bare, bare)
  );
}

/** Territory ids from BDNS region labels like "ES114 - Pontevedra". */
export function territoriesFromRegions(regions: { descripcion: string | null }[]): string[] {
  const ids = new Set<string>();
  for (const r of regions) {
    const code = r.descripcion?.split(" - ")[0]?.trim();
    const id = code ? territoryFromNuts(code) : undefined;
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

/** Narrowest territory that contains all the given ones (defaults to "es"). */
export function commonTerritory(ids: string[]): string {
  if (!ids.length) return "es";
  const chains = ids.map((id) => territoryAncestors(id));
  return chains[0]!.find((candidate) => chains.every((c) => c.includes(candidate))) ?? "es";
}

const CCAA_ALIASES: Record<string, string> = {
  "comunidad valenciana": "10",
  "comunitat valenciana": "10",
  "illes balears": "04",
  "islas baleares": "04",
  "principado de asturias": "03",
  asturias: "03",
  "comunidad de madrid": "13",
  madrid: "13",
  "region de murcia": "14",
  murcia: "14",
  "comunidad foral de navarra": "15",
  navarra: "15",
  "pais vasco": "16",
  euskadi: "16",
  "la rioja": "17",
  "castilla la mancha": "08",
  "castilla-la mancha": "08",
  "ciudad autonoma de ceuta": "18",
  ceuta: "18",
  "ciudad autonoma de melilla": "19",
  melilla: "19",
};

export function ccaaFromName(name: string): string | undefined {
  const n = normalizeName(name);
  if (CCAA_ALIASES[n]) return CCAA_ALIASES[n];
  return AUTONOMOUS_COMMUNITIES.find((c) => normalizeName(c.name) === n)?.ine;
}

export type OrganismInfo = {
  adminLevel: AdminLevel;
  sourceKey: string;
  name: string;
  parentName: string | null;
  territoryId: string;
};

const PROVINCIAL_BODY =
  /^(excmo\.? |excma\.? )?(diputacion|diputacio|cabildo|consell insular|consejo insular)/;
/** Bodies above the municipality but below the province. */
const SUPRAMUNICIPAL =
  /^(comarca|consell comarcal|consejo comarcal|mancomunidad|mancomunitat|consorcio|consorci|entidad local menor|entidad metropolitana|area metropolitana|agrupacion)|entidad local menor$/;

/** Islands whose cabildo/consell acts at (roughly) provincial level. */
const ISLAND_PROVINCE: Record<string, string> = {
  tenerife: "38",
  "la palma": "38",
  "la gomera": "38",
  "el hierro": "38",
  "gran canaria": "35",
  lanzarote: "35",
  fuerteventura: "35",
  mallorca: "07",
  menorca: "07",
  eivissa: "07",
  ibiza: "07",
  formentera: "07",
};

/** Province named in "DIPUTACIÓN PROV. DE ZAMORA", "CABILDO INSULAR DE TENERIFE"… */
export function provinceFromBodyName(name: string): string | undefined {
  const n = normalizeName(name).replace(/^(excmo|excma)\.? /, "");
  const m = /(?:de|d')\s*(.+)$/.exec(n);
  const target = m?.[1]?.replace(/^(la|el|les|l')\s+/, (a) => a) ?? "";
  for (const [island, prov] of Object.entries(ISLAND_PROVINCE)) {
    if (target === island || target.endsWith(` ${island}`) || n.endsWith(island)) return prov;
  }
  return PROVINCES.find((p) => nameVariants(p.name).some((v) => v === target || n.endsWith(v)))
    ?.ine;
}

/** Organism and the territory it governs, from the BDNS organ hierarchy. */
export function resolveOrganism(
  organo: { nivel1: string | null; nivel2: string | null; nivel3: string | null },
  regionTerritories: string[],
  municipalities: MunicipalityIndex,
): OrganismInfo {
  const [n1, n2, n3] = [organo.nivel1 ?? "", organo.nivel2 ?? "", organo.nivel3 ?? ""];
  const sourceKey = [n1, n2, n3].map((s) => s.trim()).join(" / ");
  const name = (n3 || n2 || n1).trim();
  const parentName = n3 ? n2.trim() || null : null;
  const provinces = regionTerritories
    .flatMap((t) => territoryAncestors(t))
    .filter((t) => t.startsWith("prov:"))
    .map((t) => t.slice(5));
  const fallback = commonTerritory(regionTerritories);

  switch (n1.trim().toUpperCase()) {
    case "ESTADO":
      return { adminLevel: "state", sourceKey, name, parentName, territoryId: "es" };
    case "AUTONOMICA": {
      const ccaa = ccaaFromName(n2);
      return {
        adminLevel: "regional",
        sourceKey,
        name,
        parentName,
        territoryId: ccaa ? territoryId.region(ccaa) : fallback,
      };
    }
    case "LOCAL": {
      const body = normalizeName(n3 || n2);
      const parent = normalizeName(n2);
      if (PROVINCIAL_BODY.test(parent) || PROVINCIAL_BODY.test(body)) {
        const prov = provinceFromBodyName(PROVINCIAL_BODY.test(parent) ? n2 : n3);
        return {
          adminLevel: "provincial",
          sourceKey,
          name,
          parentName,
          territoryId: prov
            ? territoryId.province(prov)
            : provinces.length === 1
              ? territoryId.province(provinces[0]!)
              : fallback,
        };
      }
      if (SUPRAMUNICIPAL.test(parent) || SUPRAMUNICIPAL.test(body)) {
        return {
          adminLevel: "other",
          sourceKey,
          name,
          parentName,
          territoryId: provinces.length === 1 ? territoryId.province(provinces[0]!) : fallback,
        };
      }
      const mun = findMunicipality(municipalities, n2, provinces);
      return {
        adminLevel: body.startsWith("ayuntamiento") || mun ? "municipal" : "other",
        sourceKey,
        name,
        parentName,
        territoryId: mun ? territoryId.municipality(mun) : fallback,
      };
    }
    default:
      return { adminLevel: "other", sourceKey, name, parentName, territoryId: fallback };
  }
}

const BENEFICIARY_BY_LABEL: [RegExp, BeneficiaryType][] = [
  [/^personas fisicas que no/, "individuals"],
  [/^pyme/, "smes_and_self_employed"],
  [/^gran empresa/, "large_companies"],
  [/^personas juridicas que no/, "non_profits"],
];

export function beneficiaryTypesFrom(items: { descripcion: string | null }[]): BeneficiaryType[] {
  const out = new Set<BeneficiaryType>();
  for (const item of items) {
    const label = normalizeName(item.descripcion ?? "");
    out.add(BENEFICIARY_BY_LABEL.find(([re]) => re.test(label))?.[1] ?? "unspecified");
  }
  return [...out].sort();
}

const PRIZE = /\b(premios?|concursos?|certamen|certamenes|galardon)/;

/** Coarse program type from the call title; refined later by extraction/review. */
export function programTypeFromTitle(title: string): ProgramType {
  return PRIZE.test(normalizeName(title)) ? "prize" : "grant_call";
}

export type DetectedCall = {
  bdnsCode: string;
  title: string;
  publishedAt: string | null;
  organism: OrganismInfo;
  programType: ProgramType;
  /** Present only once the detail has been fetched. */
  detail?: {
    territoryIds: string[];
    beneficiaryTypes: BeneficiaryType[];
    status: EditionStatus;
    opensAt: string | null;
    closesAt: string | null;
    windowText: string | null;
    budgetTotal: number | null;
    officialUrl: string | null;
    regulatoryBasesUrl: string | null;
    purpose: string | null;
    raw: BdnsDetail;
  };
};

const isoDay = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

/** From a search result only (cheap: no detail request). */
export function callFromSearchItem(
  item: BdnsSearchItem,
  municipalities: MunicipalityIndex,
): DetectedCall {
  return {
    bdnsCode: item.numeroConvocatoria,
    title: item.descripcion.trim(),
    publishedAt: isoDay(item.fechaRecepcion),
    organism: resolveOrganism(item, [], municipalities),
    programType: programTypeFromTitle(item.descripcion),
  };
}

/** From the full call detail. */
export function callFromDetail(
  detail: BdnsDetail,
  municipalities: MunicipalityIndex,
  today: string,
): DetectedCall {
  const territoryIds = territoriesFromRegions(detail.regiones);
  const opensAt = isoDay(detail.fechaInicioSolicitud);
  const closesAt = isoDay(detail.fechaFinSolicitud);
  const windowText = [detail.textInicio, detail.textFin].filter(Boolean).join(" — ") || null;
  return {
    bdnsCode: detail.codigoBDNS,
    title: detail.descripcion.trim(),
    publishedAt: isoDay(detail.fechaRecepcion),
    organism: resolveOrganism(detail.organo, territoryIds, municipalities),
    programType: programTypeFromTitle(detail.descripcion),
    detail: {
      territoryIds,
      beneficiaryTypes: beneficiaryTypesFrom(detail.tiposBeneficiarios),
      // `abierto` is not a reliable "accepting applications" flag: dates or nothing.
      status: editionStatus({ opensAt, closesAt }, today),
      opensAt,
      closesAt,
      windowText,
      budgetTotal: detail.presupuestoTotal,
      officialUrl: detail.sedeElectronica,
      regulatoryBasesUrl: detail.urlBasesReguladoras,
      purpose: detail.descripcionFinalidad,
      raw: detail,
    },
  };
}
