import { loadCatalog, loadVerificationReport, validVerification } from "../catalog";

const { benefits, issues } = loadCatalog();
for (const issue of issues) console.error(`✗ ${issue.file}: ${issue.message}`);

const drafts = benefits.filter((b) => b.status === "draft");
const archived = benefits.filter((b) => b.status === "archived");
const published = benefits.filter((b) => b.status === "published");

// Owner decision (2026-10-15): no human review; a published benefit is shown only
// if it passed the automatic verification gate with its current content
// (pnpm --filter @tetoca/verification verify:catalog). REQUIRE_VERIFIED=1 makes
// unverified published benefits an error (CI).
const report = loadVerificationReport();
const unverified = published.filter((b) => !validVerification(b, report));
const strict = process.env.REQUIRE_VERIFIED === "1";
for (const b of unverified) {
  (strict ? console.error : console.warn)(`! ${b.slug}: published but not verified (hidden)`);
}

console.log(
  `${benefits.length} benefits loaded (${published.length} published, ${archived.length} archived, ` +
    `${drafts.length} drafts), ${issues.length} issues, ${unverified.length} not verified.`,
);
process.exit(issues.length || (strict && unverified.length) ? 1 : 0);
