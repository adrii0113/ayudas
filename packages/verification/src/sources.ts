import { htmlToText, pdfToText, sha256 } from "@tetoca/ingestion";

export type FetchedSource = { url: string; text: string; mimeType: string; title: string };

/** Downloads an official page or PDF and returns its plain text. */
export async function fetchSourceText(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<FetchedSource | undefined> {
  const res = await fetchFn(url, {
    headers: { "User-Agent": "TeToca/0.1 (verificación de fuentes oficiales)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return undefined;
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (mimeType === "application/pdf" || url.toLowerCase().endsWith(".pdf")) {
    const pdf = await pdfToText(bytes);
    return pdf.text.trim()
      ? { url, text: pdf.text, mimeType: "application/pdf", title: url }
      : undefined;
  }
  const html = decodeHtml(bytes, res.headers.get("content-type"));
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || url;
  return { url, text: htmlToText(html), mimeType: mimeType || "text/html", title };
}

/**
 * Decodes an HTML page with its declared charset (HTTP header first, then
 * <meta>); many official sites still serve ISO-8859-1 / windows-1252.
 */
export function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  const label = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export { sha256 };
