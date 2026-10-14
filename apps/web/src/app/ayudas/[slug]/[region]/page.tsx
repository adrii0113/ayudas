import { BENEFIT_CATEGORIES } from "@tetoca/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CategoryIndex } from "@/components/benefit/CategoryIndex";
import { getBenefitsByCategory } from "@/lib/catalog";
import { CATEGORY_SLUGS, REGION_SLUGS, categoryFromSlug, regionFromSlug } from "@/lib/categories";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string; region: string }> };

/** /ayudas/[categoria]/[region], e.g. /ayudas/vivienda/castilla-y-leon */
export function generateStaticParams() {
  return BENEFIT_CATEGORIES.flatMap((c) =>
    Object.values(REGION_SLUGS).map((region) => ({ slug: CATEGORY_SLUGS[c], region })),
  );
}

async function resolve(params: Props["params"]) {
  const { slug, region } = await params;
  const category = categoryFromSlug(slug);
  const regionConfig = regionFromSlug(region);
  if (!category || !regionConfig) notFound();
  return { category, region: regionConfig, slug, regionSlug: region };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, region, slug, regionSlug } = await resolve(params);
  const t = await getTranslations("index");
  const tc = await getTranslations("categories");
  const vars = { category: tc(category).toLowerCase(), region: region.name };
  return {
    title: t("categoryTitle", vars),
    description: t("categoryLead", vars),
    alternates: { canonical: `/ayudas/${slug}/${regionSlug}` },
  };
}

export default async function CategoryRegionPage({ params }: Props) {
  const { category, region } = await resolve(params);
  const t = await getTranslations("index");
  const tc = await getTranslations("categories");
  const vars = { category: tc(category).toLowerCase(), region: region.name };
  return (
    <CategoryIndex
      title={t("categoryTitle", vars)}
      lead={t("categoryLead", vars)}
      benefits={await getBenefitsByCategory(category, region.code)}
    />
  );
}
