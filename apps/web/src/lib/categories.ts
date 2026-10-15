import { REGIONS, type BenefitCategory } from "@tetoca/core";

/** Spanish URL slugs for categories (SEO). */
export const CATEGORY_SLUGS: Record<BenefitCategory, string> = {
  birth: "natalidad",
  housing: "vivienda",
  energy: "energia",
  income: "ingresos",
  education: "educacion",
  dependency: "dependencia",
  employment: "empleo",
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** SEO slug per autonomous community, e.g. CL → "castilla-y-leon". */
export const REGION_SLUGS: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.code, slugify(r.name)]),
);

export function categoryFromSlug(slug: string): BenefitCategory | undefined {
  return (Object.entries(CATEGORY_SLUGS) as [BenefitCategory, string][]).find(
    ([, s]) => s === slug,
  )?.[0];
}

export function regionFromSlug(slug: string) {
  const code = Object.entries(REGION_SLUGS).find(([, s]) => s === slug)?.[0];
  return code ? REGIONS.find((r) => r.code === code) : undefined;
}
