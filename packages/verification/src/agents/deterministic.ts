import { getConstantsInForce, territoryAncestors, benefitTerritoryId } from "@tetoca/core";
import { leaves, locateQuote } from "../rules";
import {
  fromFindings,
  pass,
  skipped,
  type Finding,
  type RevisionSubject,
  type VerificationAgent,
} from "../types";

/** Every rule cites the official text, and every quote exists verbatim in it. */
export const citationsAgent: VerificationAgent = {
  name: "citations",
  version: "1",
  async run(subject) {
    const rules = leaves(subject.benefit.eligibility);
    if (!rules.length) return skipped("No eligibility rules to check");
    const findings: Finding[] = [];
    if (!subject.sources.length) {
      return {
        verdict: "uncertain",
        findings: [{ severity: "warning", message: "No official text available to check quotes" }],
      };
    }
    for (const { path, rule } of rules) {
      const excerpt = rule.source?.excerpt;
      if (!excerpt) {
        findings.push({
          severity: "warning",
          field: path,
          message: `"${rule.label}" has no quote`,
        });
        continue;
      }
      const found = subject.sources.some((s) => locateQuote(s.text, excerpt) >= 0);
      if (!found) {
        findings.push({
          severity: "error",
          field: path,
          message: `Quote for "${rule.label}" not found in the official text`,
          actual: excerpt,
        });
      }
    }
    return fromFindings(findings);
  },
};

const day = (s: string | null | undefined) => s?.slice(0, 10) ?? null;

/** Dates, URL and territory agree with the official record of the edition. */
export const sourceConsistencyAgent: VerificationAgent = {
  name: "source-consistency",
  version: "1",
  async run(subject) {
    const edition = subject.edition;
    if (!edition?.hasSourceMetadata) return skipped("No official metadata for this edition");
    const findings: Finding[] = [];
    const w = subject.benefit.window;
    for (const key of ["opensAt", "closesAt"] as const) {
      const official = day(edition[key]);
      const ours = day(w?.[key]);
      if (official && ours !== official) {
        findings.push({
          severity: "error",
          field: `window.${key}`,
          message: `Date differs from the official record`,
          expected: official,
          actual: ours,
        });
      }
    }
    const territory = benefitTerritoryId(subject.benefit);
    if (
      edition.territoryIds.length &&
      !edition.territoryIds.some(
        (t) =>
          territoryAncestors(territory).includes(t) || territoryAncestors(t).includes(territory),
      )
    ) {
      findings.push({
        severity: "error",
        field: "territory",
        message: "Territory does not match the regions of the official record",
        expected: edition.territoryIds,
        actual: territory,
      });
    }
    return fromFindings(findings);
  },
};

const usesConstants = (value: unknown): boolean => JSON.stringify(value ?? null).includes('"ref"');

/** Rules that use official parameters have values for the edition's year. */
export const parametersAgent: VerificationAgent = {
  name: "parameters",
  version: "1",
  async run(subject) {
    if (!usesConstants(subject.benefit.eligibility)) return skipped("No official parameters used");
    const year = Number(
      (subject.benefit.window?.opensAt ?? subject.edition?.opensAt ?? subject.today).slice(0, 4),
    );
    const inForce = getConstantsInForce(year);
    if (inForce.year === year) return pass();
    return fromFindings([
      {
        severity: "warning",
        message: `No official parameters registered for ${year}; using ${inForce.year} values`,
        expected: year,
        actual: inForce.year,
      },
    ]);
  },
};

/** Coherent application window, and nothing published after it closed. */
export const deadlinesAgent: VerificationAgent = {
  name: "deadlines",
  version: "1",
  async run(subject) {
    const w = subject.benefit.window;
    if (!w?.opensAt && !w?.closesAt) return skipped("No dated application window");
    const findings: Finding[] = [];
    const [opens, closes] = [day(w.opensAt), day(w.closesAt)];
    if (opens && closes && closes < opens) {
      findings.push({ severity: "error", field: "window", message: "Closes before it opens" });
    }
    for (const [key, d] of [
      ["opensAt", opens],
      ["closesAt", closes],
    ] as const) {
      const y = d ? Number(d.slice(0, 4)) : null;
      if (y && (y < 2000 || y > Number(subject.today.slice(0, 4)) + 5)) {
        findings.push({
          severity: "error",
          field: `window.${key}`,
          message: `Implausible year ${y}`,
        });
      }
    }
    if (closes && closes < subject.today && subject.benefit.status === "published") {
      findings.push({
        severity: "error",
        field: "window.closesAt",
        message: "Application window closed: archive it or add the new edition",
        actual: closes,
      });
    }
    return fromFindings(findings);
  },
};

/** Official links answer; 404/410 is an error, other failures need a look. */
export const linksAgent: VerificationAgent = {
  name: "links",
  version: "1",
  async run(subject: RevisionSubject, deps) {
    const fetchFn = deps.fetch ?? fetch;
    const urls = [
      ...new Set([subject.benefit.officialUrl, ...subject.benefit.sources.map((s) => s.url)]),
    ];
    const findings: Finding[] = [];
    for (const url of urls) {
      try {
        const res = await fetchFn(url, {
          method: "GET",
          redirect: "follow",
          headers: { "User-Agent": "TeToca/0.1 (verificación de enlaces oficiales)" },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.status === 404 || res.status === 410) {
          findings.push({
            severity: "error",
            sourceUrl: url,
            message: `Broken link (HTTP ${res.status})`,
          });
        } else if (!res.ok) {
          findings.push({ severity: "warning", sourceUrl: url, message: `HTTP ${res.status}` });
        }
        await res.body?.cancel();
      } catch (err) {
        findings.push({
          severity: "warning",
          sourceUrl: url,
          message: `Unreachable: ${(err as Error).message}`,
        });
      }
    }
    return fromFindings(findings);
  },
};
