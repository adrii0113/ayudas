import { loadCatalog } from "../catalog";

const { benefits, issues } = loadCatalog();
for (const issue of issues) console.error(`✗ ${issue.file}: ${issue.message}`);
const todo = benefits.filter((b) => JSON.stringify(b).includes("TODO(verify)"));
for (const b of todo) console.warn(`! ${b.slug}: contains TODO(verify)`);
console.log(
  `${benefits.length} benefits loaded, ${issues.length} issues, ${todo.length} with TODO(verify).`,
);
process.exit(issues.length ? 1 : 0);
