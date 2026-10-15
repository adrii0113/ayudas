"use client";

import type { BenefitMatch } from "@tetoca/core";
import { AlertCircle, CheckCircle2, ChevronRight, ExternalLink, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { WindowLabel } from "@/components/WindowLabel";
import { track } from "@/lib/analytics";

function ReqList({
  items,
  icon: Icon,
  className,
}: {
  items: { label: string }[];
  icon: typeof CheckCircle2;
  className: string;
}) {
  return (
    <ul className="space-y-1">
      {items.map((r) => (
        <li key={r.label} className="flex gap-2">
          <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${className}`} />
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="pressable flex cursor-pointer items-center gap-1.5 rounded-lg font-semibold">
      <ChevronRight aria-hidden className="disclosure-chevron size-4 text-muted" />
      {children}
    </summary>
  );
}

export function ResultCard({ match, today }: { match: BenefitMatch; today: string }) {
  const t = useTranslations();
  const { benefit } = match;
  return (
    <li className="space-y-5 rounded-3xl bg-surface p-6 shadow-card">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{t(`levels.${benefit.level}`)}</Badge>
          <Badge>{t(`categories.${benefit.category}`)}</Badge>
        </div>
        <h3 className="text-xl font-semibold">{benefit.title}</h3>
        <p className="text-muted">{benefit.summary}</p>
      </div>

      <dl className="grid gap-3 rounded-2xl bg-fill p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">{t("benefit.amount")}</dt>
          <dd className="font-medium">{benefit.amount.text}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t("benefit.deadline")}</dt>
          <dd className="font-medium">
            <WindowLabel benefit={benefit} today={today} />
          </dd>
        </div>
      </dl>

      {match.status === "almost" && match.failed.length ? (
        <div>
          <p className="font-semibold">{t("results.missing")}</p>
          <ReqList items={match.failed} icon={AlertCircle} className="text-warning-icon" />
        </div>
      ) : null}

      {match.unknown.length ? (
        <div>
          <p className="font-semibold">{t("results.unknownReqs")}</p>
          <ReqList items={match.unknown} icon={HelpCircle} className="text-muted" />
        </div>
      ) : null}

      {match.met.length ? (
        <details>
          <Summary>{t("results.whyEligible")}</Summary>
          <div className="mt-2 pl-5.5">
            <ReqList items={match.met} icon={CheckCircle2} className="text-brand-700" />
          </div>
        </details>
      ) : null}

      {benefit.otherRequirements.length ? (
        <details>
          <Summary>{t("results.alsoRequired")}</Summary>
          <ul className="mt-2 list-disc space-y-1 pl-11 marker:text-muted">
            {benefit.otherRequirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {benefit.documents.length ? (
        <details>
          <Summary>{t("results.documents")}</Summary>
          <ul className="mt-2 list-disc space-y-1 pl-11 marker:text-muted">
            {benefit.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <a
          href={benefit.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track({ name: "official_link_clicked", props: { benefit: benefit.slug } })}
          className={buttonVariants()}
        >
          {t("results.official")} <ExternalLink aria-hidden className="size-4" />
        </a>
        <Link href={`/ayudas/${benefit.slug}`} className={buttonVariants({ variant: "secondary" })}>
          {t("results.details")}
        </Link>
      </div>
    </li>
  );
}
