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
  const html = new TextDecoder().decode(bytes);
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || url;
  return { url, text: htmlToText(html), mimeType: mimeType || "text/html", title };
}

export { sha256 };
