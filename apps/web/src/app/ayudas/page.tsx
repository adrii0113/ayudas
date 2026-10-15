import { BENEFIT_CATEGORIES } from "@tetoca/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BenefitListItem } from "@/components/benefit/BenefitListItem";
import { getPublishedBenefits } from "@/lib/catalog";
import { CATEGORY_SLUGS } from "@/lib/categories";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("index");
  return { title: t("title"), description: t("lead"), alternates: { canonical: "/ayudas" } };
}

export default async function BenefitsIndexPage() {
  const t = await getTranslations();
  const benefits = await getPublishedBenefits();
  return (
    <div className="space-y-10">
      <header className="rise-in space-y-3">
        <h1 className="text-4xl font-bold">{t("index.title")}</h1>
        <p className="text-xl text-muted">{t("index.lead")}</p>
      </header>
      {BENEFIT_CATEGORIES.map((category) => {
        const items = benefits.filter((b) => b.category === category);
        if (!items.length) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="space-y-4">
            <h2 id={`cat-${category}`} className="text-2xl font-bold">
              <Link href={`/ayudas/${CATEGORY_SLUGS[category]}`} className="hover:underline">
                {t(`categories.${category}`)}
              </Link>
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((b) => (
                <BenefitListItem key={b.slug} benefit={b} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
