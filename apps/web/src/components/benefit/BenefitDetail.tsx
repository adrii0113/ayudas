import { describeRequirements, effectiveRules, needsHumanReview, type Benefit } from "@tetoca/core";
import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Disclaimer } from "@/components/Disclaimer";
import { JsonLd } from "@/components/JsonLd";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WindowLabel } from "@/components/WindowLabel";
import { formatDate } from "@/lib/format";
import { benefitJsonLd } from "@/lib/structured-data";
import { BenefitListItem } from "./BenefitListItem";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="condensed text-3xl">{title}</h2>
      {children}
    </section>
  );
}

export function BenefitDetail({ benefit, related }: { benefit: Benefit; related: Benefit[] }) {
  const t = useTranslations();
  const requirements = describeRequirements(effectiveRules(benefit));
  const pendingReview = needsHumanReview(benefit);
  return (
    <article className="space-y-10">
      {benefitJsonLd(benefit).map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      <header className="bleed bleed-band -mt-10 space-y-5 py-10 sm:py-14">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{t(`levels.${benefit.level}`)}</Badge>
          <Badge>{t(`categories.${benefit.category}`)}</Badge>
        </div>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)]">{benefit.title}</h1>
        <p className="max-w-3xl text-xl text-muted">{benefit.summary}</p>
      </header>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">{t("benefit.amount")}</dt>
            <dd className="text-lg font-semibold">{benefit.amount.text}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("benefit.deadline")}</dt>
            <dd className="text-lg font-semibold">
              <WindowLabel benefit={benefit} />
            </dd>
          </div>
          {benefit.agency ? (
            <div>
              <dt className="eyebrow">{t("benefit.agency")}</dt>
              <dd className="text-lg font-semibold">{benefit.agency}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="flex flex-col gap-4 rounded-3xl bg-brand-500 p-6 text-on-footer sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="space-y-1">
          <p className="display text-2xl">{t("benefit.check")}</p>
          <p>{t("benefit.checkBody")}</p>
        </div>
        <Link
          href="/cuestionario"
          className={buttonVariants({
            className: "bg-on-footer text-[#bf282b] hover:bg-on-footer hover:opacity-90",
          })}
        >
          {t("nav.start")}
        </Link>
      </div>

      <Section title={t("benefit.requirements")}>
        <ul className="list-disc space-y-1.5 pl-6 marker:text-muted">
          {requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {requirements.some((r) => r.includes("IPREM")) ? (
          <p className="text-sm text-muted">{t("glossary.iprem")}</p>
        ) : null}
      </Section>

      {benefit.otherRequirements.length ? (
        <Section title={t("benefit.otherRequirements")}>
          <ul className="list-disc space-y-1.5 pl-6 marker:text-muted">
            {benefit.otherRequirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {benefit.documents.length ? (
        <Section title={t("benefit.documents")}>
          <ul className="list-disc space-y-1.5 pl-6 marker:text-muted">
            {benefit.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t("benefit.steps")}>
        <ol className="list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-brand-700">
          {benefit.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <a
          href={benefit.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("benefit.official")} <ExternalLink aria-hidden className="size-4" />
        </a>
      </Section>

      {benefit.faq.length ? (
        <Section title={t("benefit.faq")}>
          <div className="callout divide-y divide-hairline overflow-hidden">
            {benefit.faq.map((f) => (
              <details key={f.question} className="px-5 py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium">
                  {f.question}
                  <ChevronRight
                    aria-hidden
                    className="disclosure-chevron size-5 shrink-0 text-muted"
                  />
                </summary>
                <p className="mt-2 text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      ) : null}

      <Disclaimer />

      <Section title={t("benefit.sources")}>
        <ul className="space-y-1 text-sm">
          {benefit.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all underline"
              >
                {s.url}
              </a>{" "}
              <span className="text-muted">
                ({t("benefit.retrieved", { date: formatDate(s.retrievedAt) })})
              </span>
            </li>
          ))}
        </ul>
        {benefit.reviewedAt ? (
          <p className="text-sm text-muted">
            {t("benefit.lastReview", { date: formatDate(benefit.reviewedAt) })}
            {pendingReview ? ` · ${t("benefit.pendingReview")}` : null}
          </p>
        ) : null}
      </Section>

      {related.length ? (
        <Section
          title={t("benefit.related", {
            category: t(`categories.${benefit.category}`).toLowerCase(),
          })}
        >
          <ul className="grid gap-4">
            {related.map((b) => (
              <BenefitListItem key={b.slug} benefit={b} />
            ))}
          </ul>
        </Section>
      ) : null}
    </article>
  );
}
