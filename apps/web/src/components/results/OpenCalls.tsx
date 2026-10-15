"use client";

import { getRegion } from "@tetoca/core";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { OpenCallsData } from "@/lib/open-calls";

const MAX = 10;

/** Detected calls of the user's community: listed with a link, never evaluated. */
export function OpenCalls({
  data,
  region,
  today,
}: {
  data: OpenCallsData;
  region?: string;
  today: string;
}) {
  const t = useTranslations("results");
  const calls = (region ? (data.byRegion[region] ?? []) : []).filter(
    (c) => !c.closesAt || c.closesAt >= today,
  );
  if (!region || !calls.length) return null;
  const name = getRegion(region)?.name ?? region;
  return (
    <section aria-labelledby="open-calls" className="space-y-5">
      <div>
        <h2 id="open-calls" className="display text-[clamp(1.5rem,3.5vw,2.25rem)]">
          {t("openCallsTitle", { region: name })}
        </h2>
        <p className="mt-2 max-w-3xl text-muted">{t("openCallsLead")}</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {calls.slice(0, MAX).map((c) => (
          <li
            key={c.bdnsCode}
            className="space-y-2 rounded-2xl border border-hairline bg-surface p-5"
          >
            <Badge tone="warning">{t("openCallsBadge")}</Badge>
            <h3 className="font-semibold leading-snug">{c.title}</h3>
            <p className="text-sm text-muted">{c.organism}</p>
            <p className="text-sm">
              {c.closesAt ? t("openCallsCloses", { date: formatDate(c.closesAt) }) : c.windowText}
            </p>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 underline underline-offset-4"
            >
              {t("openCallsLink")} <ExternalLink aria-hidden className="size-4" />
            </a>
          </li>
        ))}
      </ul>
      {data.generatedAt ? (
        <p className="text-sm text-muted">
          {t("openCallsSource", { date: formatDate(data.generatedAt) })}
        </p>
      ) : null}
    </section>
  );
}
