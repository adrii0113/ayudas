import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BenefitDetail } from "@/components/benefit/BenefitDetail";
import { CategoryIndex } from "@/components/benefit/CategoryIndex";
import { getBenefitBySlug, getBenefitsByCategory, getPublishedBenefits } from "@/lib/catalog";
import { CATEGORY_SLUGS, categoryFromSlug } from "@/lib/categories";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

/** This route serves both benefit pages and category index pages (Spanish slugs). */
export async function generateStaticParams() {
  const benefits = await getPublishedBenefits();
  return [
    ...benefits.map((b) => ({ slug: b.slug })),
    ...Object.values(CATEGORY_SLUGS).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations();
  const category = categoryFromSlug(slug);
  if (category) {
    const name = t(`categories.${category}`);
    return { title: name, alternates: { canonical: `/ayudas/${slug}` } };
  }
  const benefit = await getBenefitBySlug(slug);
  if (!benefit) return {};
  return {
    title: benefit.title,
    description: benefit.summary,
    alternates: { canonical: `/ayudas/${slug}` },
    openGraph: { title: benefit.title, description: benefit.summary, type: "article" },
  };
}

export default async function BenefitOrCategoryPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations();
  const category = categoryFromSlug(slug);
  if (category) {
    const name = t(`categories.${category}`);
    return (
      <CategoryIndex
        title={name}
        lead={t("index.lead")}
        benefits={await getBenefitsByCategory(category)}
      />
    );
  }
  const benefit = await getBenefitBySlug(slug);
  if (!benefit) notFound();
  const related = (await getBenefitsByCategory(benefit.category))
    .filter((b) => b.slug !== benefit.slug && (b.level === "state" || b.region === benefit.region))
    .slice(0, 3);
  return <BenefitDetail benefit={benefit} related={related} />;
}
