import { extractText, getDocumentProxy } from "unpdf";

export type PdfText = {
  text: string;
  pages: number;
  /** True when the PDF has (almost) no text layer, e.g. a scanned document. */
  looksScanned: boolean;
};

/** Minimum characters per page below which a PDF is considered scanned. */
const MIN_CHARS_PER_PAGE = 200;

/** Extracts the text layer of a PDF. No OCR in the MVP: scanned PDFs are flagged. */
export async function pdfToText(data: Uint8Array): Promise<PdfText> {
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const clean = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    text: clean,
    pages: totalPages,
    looksScanned: clean.length < MIN_CHARS_PER_PAGE * Math.max(1, totalPages) * 0.5,
  };
}
