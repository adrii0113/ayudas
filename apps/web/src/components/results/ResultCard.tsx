"use client";

import type { BenefitMatch } from "@tetoca/core";
import { AlertCircle, CheckCircle2, ExternalLink, HelpCircle } from "lucide-react";
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

export function ResultCard({ match, today }: { match: BenefitMatch; today: string }) {
  const t = useTranslations();
  const { benefit } = match;
  return (
    <li className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{t(`levels.${benefit.level}`)}</Badge>
          <Badge>{t(`categories.${benefit.category}`)}</Badge>
        </div>
        <h3 className="text-xl font-semibold">{benefit.title}</h3>
        <p className="text-muted">{benefit.summary}</p>
      </div>

      <dl className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2">
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
          <ReqList items={match.failed} icon={AlertCircle} className="text-amber-700" />
        </div>
      ) : null}

      {match.unknown.length ? (
        <div>
          <p className="font-semibold">{t("results.unknownReqs")}</p>
          <ReqList items={match.unknown} icon={HelpCircle} className="text-gray-500" />
        </div>
      ) : null}

      {match.met.length ? (
        <details>
          <summary className="cursor-pointer font-semibold">{t("results.whyEligible")}</summary>
          <div className="mt-2">
            <ReqList items={match.met} icon={CheckCircle2} className="text-brand-700" />
          </div>
        </details>
      ) : null}

      {benefit.otherRequirements.length ? (
        <details>
          <summary className="cursor-pointer font-semibold">{t("results.alsoRequired")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {benefit.otherRequirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {benefit.documents.length ? (
        <details>
          <summary className="cursor-pointer font-semibold">{t("results.documents")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {benefit.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
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
