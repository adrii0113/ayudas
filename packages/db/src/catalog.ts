import { benefitSchema, lintRules, type Benefit } from "@tetoca/core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export type CatalogIssue = { file: string; message: string };

/** Finds the monorepo root (the folder containing pnpm-workspace.yaml). */
export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Could not find the repository root");
    dir = parent;
  }
  return dir;
}

export function defaultSeedDir(): string {
  return join(findRepoRoot(), "data", "seed");
}

/**
 * Loads and validates the hand-curated catalog (one benefit per YAML file).
 * Returns valid benefits and a list of issues; callers decide whether issues
 * are fatal (CI) or not.
 */
export function loadCatalog(dir = defaultSeedDir()): {
  benefits: Benefit[];
  issues: CatalogIssue[];
} {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  const benefits: Benefit[] = [];
  const issues: CatalogIssue[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    let raw: unknown;
    try {
      raw = parse(readFileSync(join(dir, file), "utf8"));
    } catch (err) {
      issues.push({ file, message: `Invalid YAML: ${(err as Error).message}` });
      continue;
    }
    const withId =
      raw && typeof raw === "object" && !("id" in raw) && "slug" in raw
        ? { id: (raw as { slug: string }).slug, ...raw }
        : raw;
    const parsed = benefitSchema.safeParse(withId);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ file, message: `${issue.path.join(".") || "(root)"}: ${issue.message}` });
      }
      continue;
    }
    const benefit = parsed.data;
    for (const message of lintRules(benefit.eligibility)) issues.push({ file, message });
    const key = `${benefit.slug}@${benefit.version}`;
    if (seen.has(key)) {
      issues.push({ file, message: `Duplicate slug/version ${key} (also in ${seen.get(key)})` });
      continue;
    }
    seen.set(key, file);
    benefits.push(benefit);
  }
  return { benefits, issues };
}
