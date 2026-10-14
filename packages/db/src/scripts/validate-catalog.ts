import { needsHumanReview } from "@tetoca/core";
import { loadCatalog } from "../catalog";

const { benefits, issues } = loadCatalog();
for (const issue of issues) console.error(`✗ ${issue.file}: ${issue.message}`);

const drafts = benefits.filter((b) => b.status === "draft");
for (const b of drafts) console.warn(`· ${b.slug}: draft (not public)`);

// Benefits curated by an AI assistant must be reviewed by a person before going
// public. Set REQUIRE_HUMAN_REVIEW=1 in production builds to enforce it.
const pending = benefits.filter((b) => b.status === "published" && needsHumanReview(b));
const strict = process.env.REQUIRE_HUMAN_REVIEW === "1";
for (const b of pending) {
  (strict ? console.error : console.warn)(`! ${b.slug}: published but pending human review`);
}

console.log(
  `${benefits.length} benefits loaded (${benefits.length - drafts.length} published, ${drafts.length} drafts), ` +
    `${issues.length} issues, ${pending.length} pending human review.`,
);
process.exit(issues.length || (strict && pending.length) ? 1 : 0);
