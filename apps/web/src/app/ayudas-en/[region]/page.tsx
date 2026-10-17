import { deriveProgramType, todayInSpain, type Benefit } from "@tetoca/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BenefitListItem } from "@/components/benefit/BenefitListItem";
import { JsonLd } from "@/components/JsonLd";
import { OpenCalls } from "@/components/results/OpenCalls";
import { SectionBand } from "@/components/SectionBand";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedBenefits } from "@/lib/catalog";
import { REGION_SLUGS, regionFromSlug } from "@/lib/categories";
import { getOpenCalls } from "@/lib/open-calls";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

type Props = { params: Promise<{ region: string }> };

/** /ayudas-en/[region], e.g. /ayudas-en/andalucia: the hub of one community. */
export function generateStaticParams() {
  return Object.values(REGION_SLUGS).map((region) => ({ region }));
}

async function resolve(params: Props["params"]) {
  const { region } = await params;
  const config = regionFromSlug(region);
  if (!config) notFound();
  return { config, slug: region, year: todayInSpain().slice(0, 4) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config, slug, year } = await resolve(params);
  const t = await getTranslations("region");
  return {
    title: t("metaTitle", { region: config.name, year }),
    description: t("lead", { region: config.name }),
    alternates: { canonical: `/ayudas-en/${slug}` },
  };
}

function Group({
  id,
  title,
  lead,
  items,
}: {
  id: string;
  title: string;
  lead?: string;
  items: Benefit[];
}) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="display text-[clamp(1.75rem,4vw,2.5rem)]">
          {title}
        </h2>
        {lead ? <p className="mt-2 text-muted">{lead}</p> : null}
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((b) => (
          <BenefitListItem key={b.slug} benefit={b} />
        ))}
      </ul>
    </section>
  );
}

export default async function RegionHubPage({ params }: Props) {
  const { config, slug, year } = await resolve(params);
  const t = await getTranslations("region");
  const benefits = await getPublishedBenefits();
  const regional = benefits.filter((b) => b.level !== "state" && b.region === config.code);
  const isIncome = (b: Benefit) =>
    deriveProgramType(b) === "cash_benefit" && b.category === "income";
  const isDeduction = (b: Benefit) => deriveProgramType(b) === "tax_deduction";
  const income = regional.filter(isIncome);
  const deductions = regional.filter(isDeduction);
  const other = regional.filter((b) => !isIncome(b) && !isDeduction(b));
  const state = benefits.filter((b) => b.level === "state");
  const listed = [...income, ...deductions, ...other, ...state];

  return (
    <div className="space-y-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("title", { region: config.name, year }),
          url: siteUrl(`/ayudas-en/${slug}`),
          itemListElement: listed.map((b, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: siteUrl(`/ayudas/${b.slug}`),
            name: b.title,
          })),
        }}
      />
      <header className="-mt-10">
        <SectionBand
          as="h1"
          eyebrow={t("eyebrow")}
          title={t("title", { region: config.name, year })}
        >
          <p className="max-w-2xl text-lg text-muted">{t("lead", { region: config.name })}</p>
          <Link href="/cuestionario" className={buttonVariants({ size: "lg" })}>
            {t("checkTitle")}
          </Link>
        </SectionBand>
      </header>

      <Group id="income" title={t("minimumIncome")} items={income} />
      <Group
        id="deductions"
        title={t("deductions")}
        lead={t("deductionsLead")}
        items={deductions}
      />
      <Group id="other" title={t("other", { region: config.name })} items={other} />
      <OpenCalls data={getOpenCalls()} region={config.code} today={todayInSpain()} />
      <Group id="state" title={t("state")} lead={t("stateLead")} items={state} />

      <section className="bleed bleed-brand py-12">
        <div className="space-y-5 rounded-3xl bg-bg p-8 sm:p-12">
          <h2 className="display text-[clamp(1.75rem,4vw,2.75rem)]">{t("checkTitle")}</h2>
          <p className="max-w-2xl text-lg text-muted">{t("checkBody")}</p>
          <Link href="/cuestionario" className={buttonVariants({ size: "lg" })}>
            {t("checkTitle")} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
