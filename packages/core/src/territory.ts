/**
 * Spanish territorial units used to scope benefits and filter the catalog.
 *
 * Codes:
 * - INE codes (Instituto Nacional de Estadística): autonomous community (2 digits),
 *   province (2 digits) and municipality (5 digits = province + 3).
 *   Source: INE, "Relación de municipios y códigos por comunidades autónomas y
 *   provincias a 1 de enero de 2026" (https://www.ine.es/daco/daco42/codmun/diccionario26.xlsx).
 * - ISO 3166-2:ES codes for autonomous communities (used in HouseholdProfile.region).
 * - NUTS 2021 codes (Eurostat), which is what the BDNS uses for its regions.
 *
 * Territory ids are prefixed so levels never collide ("ccaa:07" vs "prov:07"):
 * "es", "ccaa:<ine>", "prov:<ine>", "mun:<ine5>".
 */

export const TERRITORY_LEVELS = ["country", "region", "province", "municipality"] as const;
export type TerritoryLevel = (typeof TERRITORY_LEVELS)[number];

/** País Vasco (its three historical territories) and Navarra have their own income tax. */
export type FiscalRegime = "common" | "foral";

export type AutonomousCommunity = {
  ine: string;
  iso: string;
  name: string;
  nuts2: string;
  fiscalRegime: FiscalRegime;
};

export type Province = {
  ine: string;
  name: string;
  ccaaIne: string;
  /** NUTS3 units covering the province (island provinces have several). */
  nuts3: string[];
  fiscalRegime: FiscalRegime;
};

export const AUTONOMOUS_COMMUNITIES: AutonomousCommunity[] = [
  { ine: "01", iso: "AN", name: "Andalucía", nuts2: "ES61", fiscalRegime: "common" },
  { ine: "02", iso: "AR", name: "Aragón", nuts2: "ES24", fiscalRegime: "common" },
  { ine: "03", iso: "AS", name: "Principado de Asturias", nuts2: "ES12", fiscalRegime: "common" },
  { ine: "04", iso: "IB", name: "Illes Balears", nuts2: "ES53", fiscalRegime: "common" },
  { ine: "05", iso: "CN", name: "Canarias", nuts2: "ES70", fiscalRegime: "common" },
  { ine: "06", iso: "CB", name: "Cantabria", nuts2: "ES13", fiscalRegime: "common" },
  { ine: "07", iso: "CL", name: "Castilla y León", nuts2: "ES41", fiscalRegime: "common" },
  { ine: "08", iso: "CM", name: "Castilla-La Mancha", nuts2: "ES42", fiscalRegime: "common" },
  { ine: "09", iso: "CT", name: "Cataluña", nuts2: "ES51", fiscalRegime: "common" },
  { ine: "10", iso: "VC", name: "Comunitat Valenciana", nuts2: "ES52", fiscalRegime: "common" },
  { ine: "11", iso: "EX", name: "Extremadura", nuts2: "ES43", fiscalRegime: "common" },
  { ine: "12", iso: "GA", name: "Galicia", nuts2: "ES11", fiscalRegime: "common" },
  { ine: "13", iso: "MD", name: "Comunidad de Madrid", nuts2: "ES30", fiscalRegime: "common" },
  { ine: "14", iso: "MC", name: "Región de Murcia", nuts2: "ES62", fiscalRegime: "common" },
  {
    ine: "15",
    iso: "NC",
    name: "Comunidad Foral de Navarra",
    nuts2: "ES22",
    fiscalRegime: "foral",
  },
  { ine: "16", iso: "PV", name: "País Vasco", nuts2: "ES21", fiscalRegime: "foral" },
  { ine: "17", iso: "RI", name: "La Rioja", nuts2: "ES23", fiscalRegime: "common" },
  { ine: "18", iso: "CE", name: "Ceuta", nuts2: "ES63", fiscalRegime: "common" },
  { ine: "19", iso: "ML", name: "Melilla", nuts2: "ES64", fiscalRegime: "common" },
];

const p = (
  ine: string,
  name: string,
  ccaaIne: string,
  nuts3: string[],
  fiscalRegime: FiscalRegime = "common",
): Province => ({ ine, name, ccaaIne, nuts3, fiscalRegime });

export const PROVINCES: Province[] = [
  p("01", "Araba/Álava", "16", ["ES211"], "foral"),
  p("02", "Albacete", "08", ["ES421"]),
  p("03", "Alicante/Alacant", "10", ["ES521"]),
  p("04", "Almería", "01", ["ES611"]),
  p("05", "Ávila", "07", ["ES411"]),
  p("06", "Badajoz", "11", ["ES431"]),
  p("07", "Illes Balears", "04", ["ES531", "ES532", "ES533"]),
  p("08", "Barcelona", "09", ["ES511"]),
  p("09", "Burgos", "07", ["ES412"]),
  p("10", "Cáceres", "11", ["ES432"]),
  p("11", "Cádiz", "01", ["ES612"]),
  p("12", "Castellón/Castelló", "10", ["ES522"]),
  p("13", "Ciudad Real", "08", ["ES422"]),
  p("14", "Córdoba", "01", ["ES613"]),
  p("15", "A Coruña", "12", ["ES111"]),
  p("16", "Cuenca", "08", ["ES423"]),
  p("17", "Girona", "09", ["ES512"]),
  p("18", "Granada", "01", ["ES614"]),
  p("19", "Guadalajara", "08", ["ES424"]),
  p("20", "Gipuzkoa", "16", ["ES212"], "foral"),
  p("21", "Huelva", "01", ["ES615"]),
  p("22", "Huesca", "02", ["ES241"]),
  p("23", "Jaén", "01", ["ES616"]),
  p("24", "León", "07", ["ES413"]),
  p("25", "Lleida", "09", ["ES513"]),
  p("26", "La Rioja", "17", ["ES230"]),
  p("27", "Lugo", "12", ["ES112"]),
  p("28", "Madrid", "13", ["ES300"]),
  p("29", "Málaga", "01", ["ES617"]),
  p("30", "Murcia", "14", ["ES620"]),
  p("31", "Navarra", "15", ["ES220"], "foral"),
  p("32", "Ourense", "12", ["ES113"]),
  p("33", "Asturias", "03", ["ES120"]),
  p("34", "Palencia", "07", ["ES414"]),
  p("35", "Las Palmas", "05", ["ES704", "ES705", "ES708"]),
  p("36", "Pontevedra", "12", ["ES114"]),
  p("37", "Salamanca", "07", ["ES415"]),
  p("38", "Santa Cruz de Tenerife", "05", ["ES703", "ES706", "ES707", "ES709"]),
  p("39", "Cantabria", "06", ["ES130"]),
  p("40", "Segovia", "07", ["ES416"]),
  p("41", "Sevilla", "01", ["ES618"]),
  p("42", "Soria", "07", ["ES417"]),
  p("43", "Tarragona", "09", ["ES514"]),
  p("44", "Teruel", "02", ["ES242"]),
  p("45", "Toledo", "08", ["ES425"]),
  p("46", "Valencia/València", "10", ["ES523"]),
  p("47", "Valladolid", "07", ["ES418"]),
  p("48", "Bizkaia", "16", ["ES213"], "foral"),
  p("49", "Zamora", "07", ["ES419"]),
  p("50", "Zaragoza", "02", ["ES243"]),
  p("51", "Ceuta", "18", ["ES630"]),
  p("52", "Melilla", "19", ["ES640"]),
];

export const territoryId = {
  country: () => "es",
  region: (ine: string) => `ccaa:${ine}`,
  province: (ine: string) => `prov:${ine}`,
  municipality: (ine5: string) => `mun:${ine5}`,
};

export function ccaaByIso(iso: string) {
  return AUTONOMOUS_COMMUNITIES.find((c) => c.iso === iso);
}

export function ccaaByIne(ine: string) {
  return AUTONOMOUS_COMMUNITIES.find((c) => c.ine === ine);
}

export function provinceByIne(ine: string) {
  return PROVINCES.find((pr) => pr.ine === ine);
}

/** Province of a 5-digit INE municipality code. */
export function provinceOfMunicipality(ine5: string) {
  return provinceByIne(ine5.slice(0, 2));
}

/**
 * Resolves a NUTS code (as used by the BDNS) to our territory id: "ES" is the
 * whole country, NUTS2 an autonomous community, NUTS3 a province.
 * NUTS1 groupings (e.g. "ES4 - Centro") have no administrative meaning here.
 */
export function territoryFromNuts(nuts: string): string | undefined {
  const code = nuts.trim().toUpperCase();
  if (code === "ES") return territoryId.country();
  if (code.length === 4) {
    const ccaa = AUTONOMOUS_COMMUNITIES.find((c) => c.nuts2 === code);
    return ccaa ? territoryId.region(ccaa.ine) : undefined;
  }
  if (code.length === 5) {
    const prov = PROVINCES.find((pr) => pr.nuts3.includes(code));
    return prov ? territoryId.province(prov.ine) : undefined;
  }
  return undefined;
}

/** Ancestors of a territory id, from itself up to "es". */
export function territoryAncestors(id: string): string[] {
  const [level, code] = id.split(":") as [string, string | undefined];
  if (level === "es") return ["es"];
  if (level === "ccaa") return [id, "es"];
  if (level === "prov" && code) {
    const prov = provinceByIne(code);
    return prov ? [id, territoryId.region(prov.ccaaIne), "es"] : [id, "es"];
  }
  if (level === "mun" && code) {
    const prov = provinceOfMunicipality(code);
    return prov
      ? [id, territoryId.province(prov.ine), territoryId.region(prov.ccaaIne), "es"]
      : [id, "es"];
  }
  return [id];
}

/** Fiscal regime of any territory id (foral in País Vasco and Navarra). */
export function fiscalRegimeOf(id: string): FiscalRegime | undefined {
  for (const t of territoryAncestors(id)) {
    const [level, code] = t.split(":");
    if (level === "prov" && code) return provinceByIne(code)?.fiscalRegime;
    if (level === "ccaa" && code) return ccaaByIne(code)?.fiscalRegime;
  }
  return undefined;
}
