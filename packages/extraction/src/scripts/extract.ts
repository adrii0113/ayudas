/**
 * Extracts draft benefits from stored source documents with Claude.
 *
 *   pnpm --filter @tetoca/extraction extract [--document <id>] [--limit N] [--force]
 *
 * Without --document, processes documents that have no extraction yet.
 * Requires DATABASE_URL and ANTHROPIC_API_KEY. Drafts must be reviewed in /admin.
 */
import { createDb, listDocumentsWithoutExtraction } from "@tetoca/db";
import { AnthropicProvider } from "@tetoca/llm";
import { parseArgs } from "node:util";
import { extractDocument } from "../pipeline";

const { values } = parseArgs({
  options: {
    document: { type: "string" },
    limit: { type: "string", default: "10" },
    force: { type: "boolean", default: false },
  },
});

const db = createDb();
const llm = new AnthropicProvider();
const ids = values.document
  ? [values.document]
  : await listDocumentsWithoutExtraction(db, Number(values.limit));

for (const documentId of ids) {
  const outcome = await extractDocument({ db, llm, documentId, force: values.force });
  console.log(documentId, outcome.status, "reason" in outcome ? outcome.reason : "");
}
await db.$client.end();
