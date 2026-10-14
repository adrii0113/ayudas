import { createHash } from "node:crypto";

/** Converts simple HTML (BDNS announcements) to plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
