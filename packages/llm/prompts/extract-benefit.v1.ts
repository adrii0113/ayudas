import { CONSTANT_KEYS, DERIVED_FIELDS, FIELD_KINDS, PROFILE_FIELDS } from "@tetoca/core";

/**
 * Prompt to extract a benefit from an official call/regulation text.
 * Bump the version whenever the text changes: it is stored with every
 * extraction and is part of the cache key.
 */
export const EXTRACT_BENEFIT_PROMPT_VERSION = "extract-benefit@1";

const FIELD_DOCS: Record<string, string> = {
  region: 'CCAA code of the applicant ("CL" = Castilla y León)',
  municipality: 'INE municipality code ("47186" = Valladolid)',
  applicantAge: "age of the person who applies",
  householdSize: "people living in the home, including the applicant and children",
  children: "number of children (prefer numChildren)",
  annualHouseholdIncome: "approximate yearly income of the whole household, euros",
  employmentStatus: "employed | unemployed | self_employed | student | retired | other",
  housing: "renting | owner_mortgage | owner_no_mortgage | other",
  monthlyRent: "monthly rent in euros",
  isLargeFamily: "holds a familia numerosa title",
  isSingleParent: "single-parent family (familia monoparental)",
  hasDependentPerson: "lives with / cares for a dependent person",
  applicantDisabilityPercent: "recognised disability % of the applicant",
  yearsRegisteredInRegion: "years registered (empadronado) in the region",
  yearsLegalResidenceInSpain: "years of legal residence in Spain",
  receivesMinimumIncome: "someone in the home receives the Ingreso Mínimo Vital",
  numChildren: "number of children",
  numMinors: "number of children under 18",
  youngestChildAge: "age of the youngest child (0 = born this year)",
  oldestChildAge: "age of the oldest child",
  numChildrenWithDisability: "children with disability ≥ 33 %",
  numAdults: "adults in the home",
  extraAdults: "adults in the home minus one",
  incomePerCapita: "annualHouseholdIncome / householdSize",
};

const fieldList = [...PROFILE_FIELDS, ...DERIVED_FIELDS]
  .map((f) => {
    const kind = FIELD_KINDS[f];
    const type = typeof kind === "string" ? kind : `one of ${kind.enum.join(" | ")}`;
    return `- ${f} (${type}): ${FIELD_DOCS[f] ?? ""}`;
  })
  .join("\n");

export const EXTRACT_BENEFIT_SYSTEM = `You help a public-benefits website for Spanish households turn official texts (calls for applications, regulatory bases, official pages) into structured data. A person reviews every result before it is published, and a deterministic rules engine — not you — decides who is eligible. Your job is a faithful, traceable transcription of what the text says.

## What to produce
- isHouseholdBenefit: false if the text is not a benefit that individuals or families can apply for (grants to companies, associations or municipalities, prizes, employee training for companies, internal administration…). In that case set benefit to null and explain why in uncertainties.
- benefit: the structured benefit, in plain Spanish written for ordinary citizens (no legal jargon; summary of at most two sentences).
- uncertainties: everything you could not determine or had to approximate, in Spanish, one item per issue. Reviewers rely on this list.

## Eligibility rules
Express the main requirements as rules over these profile fields (no other fields exist):
${fieldList}

A rule is { field, op, value, label, hard, excerpt }:
- op: eq | neq | lt | lte | gt | gte | in | exists ("exists" ignores value; use null for it).
- value: a literal, or an arithmetic expression over these official constants and numeric fields: ${CONSTANT_KEYS.join(", ")}. Expressions: {"ref": name} | {"add": [...]} | {"mul": [...]} | {"min": [...]}. Example "3 veces el IPREM": {"mul": [3, {"ref": "iprem14"}]}. Use iprem14 when the text uses IPREM in 14 payments or annual IPREM without saying, ipremMonthly for monthly amounts. Never compute euro amounts yourself from IPREM.
- label: the requirement in plain Spanish, as a citizen would read it.
- hard: true for requirements a household cannot reasonably change to qualify (having children, family composition, place of residence, minimum-income thresholds); false otherwise.
- excerpt: the literal fragment of the text that justifies the rule, copied verbatim (no paraphrase). If you cannot quote it, do not create the rule; mention it in uncertainties instead.
Groups: {"all": [...]} means every item applies, {"any": [...]} at least one; groups can nest up to 3 levels. Do not add region/municipality rules: scope comes from level/region/municipality.
Requirements that do not map to these fields (nationality, being up to date with taxes, documents, not owning another home…) go to otherRequirements in plain Spanish.

## Other fields
- slug: kebab-case, descriptive, include the region and year when relevant.
- level: state | regional | municipal; region "CL" for Castilla y León; municipality as INE code when municipal.
- category: birth | housing | energy | income | education | dependency | employment.
- kind: "call" if it has an application window, "permanent" otherwise. Dates in YYYY-MM-DD; if the deadline depends on publication or another event, leave dates empty and explain in window.text.
- amount: type fixed | range | percent | variable; min/max as numbers when stated; text in plain Spanish.
- officialUrl: the official page or electronic office where it is applied for, only if it appears in the text.
- Only use information present in the text. Never invent amounts, thresholds, dates or URLs.`;

export function buildExtractBenefitPrompt(meta: { sourceUrl: string; feedback?: string }): string {
  const base = `Extract the benefit described in the attached document (source: ${meta.sourceUrl}).`;
  if (!meta.feedback) return base;
  return `${base}\n\nA previous attempt failed validation with these errors. Fix them and return the complete result again:\n${meta.feedback}`;
}
