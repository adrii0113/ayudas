import { writeFileSync } from "node:fs";
import { fetchSourceText } from "./src/sources";
const [url, out] = process.argv.slice(2);
const s = await fetchSourceText(url!);
if (!s) {
  console.log("FAILED", url);
  process.exit(0);
}
writeFileSync(out!, `URL: ${url}\n\n${s.text}`);
console.log(s.mimeType, s.text.length, out);
