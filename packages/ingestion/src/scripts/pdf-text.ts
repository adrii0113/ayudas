import { readFileSync } from "node:fs";
import { pdfToText } from "../pdf";

const file = process.argv[2];
if (!file) throw new Error("Usage: pdf-text <file.pdf>");
const result = await pdfToText(new Uint8Array(readFileSync(file)));
console.log(`# pages=${result.pages} scanned=${result.looksScanned}\n`);
console.log(result.text);
