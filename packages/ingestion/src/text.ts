import { createHash } from "node:crypto";

/** Named entities found in Spanish official pages (accents, ñ, ordinals, quotes, euro…). */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  agrave: "à",
  egrave: "è",
  ograve: "ò",
  Agrave: "À",
  Egrave: "È",
  Ograve: "Ò",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iuml: "ï",
  ccedil: "ç",
  Ccedil: "Ç",
  ordf: "ª",
  ordm: "º",
  deg: "°",
  euro: "€",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  iexcl: "¡",
  iquest: "¿",
  shy: "",
};

/** Decodes numeric (&#233; &#xE9;) and common named HTML entities. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

/** Converts simple HTML (BDNS announcements, official pages) to plain text. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Removes signature/verification boilerplate repeated on every page of JCyL PDFs. */
export function stripBoilerplate(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) =>
        !/^(COPIA AUTENTICA DEL DOCUMENTO|Fecha Firma:|Firmado:|Acceda a la página web:)/.test(
          line.trim(),
        ),
    )
    .join("\n")
    .replace(/COPIA AUTENTICA DEL DOCUMENTO Localizador: \S+/g, "");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
