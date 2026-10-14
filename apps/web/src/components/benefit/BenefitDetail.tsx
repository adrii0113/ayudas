import { describeRequirements, effectiveRules, needsHumanReview, type Benefit } from "@tetoca/core";
import { ExternalLink } from "lucide-react";
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
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function BenefitDetail({ benefit, related }: { benefit: Benefit; related: Benefit[] }) {
  const t = useTranslations();
  const requirements = describeRequirements(effectiveRules(benefit));
  const pendingReview = needsHumanReview(benefit);
  return (
    <article className="space-y-8">
      {benefitJsonLd(benefit).map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{t(`levels.${benefit.level}`)}</Badge>
          <Badge>{t(`categories.${benefit.category}`)}</Badge>
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">{benefit.title}</h1>
        <p className="text-lg text-muted">{benefit.summary}</p>
      </header>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-muted">{t("benefit.amount")}</dt>
            <dd className="font-semibold">{benefit.amount.text}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">{t("benefit.deadline")}</dt>
            <dd className="font-semibold">
              <WindowLabel benefit={benefit} />
            </dd>
          </div>
          {benefit.agency ? (
            <div>
              <dt className="text-sm font-medium text-muted">{t("benefit.agency")}</dt>
              <dd className="font-semibold">{benefit.agency}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{t("benefit.check")}</p>
          <p className="text-muted">{t("benefit.checkBody")}</p>
        </div>
        <Link href="/cuestionario" className={buttonVariants()}>
          {t("nav.start")}
        </Link>
      </div>

      <Section title={t("benefit.requirements")}>
        <ul className="list-disc space-y-1 pl-6">
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
          <ul className="list-disc space-y-1 pl-6">
            {benefit.otherRequirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {benefit.documents.length ? (
        <Section title={t("benefit.documents")}>
          <ul className="list-disc space-y-1 pl-6">
            {benefit.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t("benefit.steps")}>
        <ol className="list-decimal space-y-1 pl-6">
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
          <div className="space-y-2">
            {benefit.faq.map((f) => (
              <details key={f.question} className="rounded-xl border border-gray-200 bg-white p-4">
                <summary className="cursor-pointer font-medium">{f.question}</summary>
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
