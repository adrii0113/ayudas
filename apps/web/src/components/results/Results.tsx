"use client";

import { evaluate, todayInSpain, type Benefit, type BenefitMatch } from "@tetoca/core";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import { clearAnswers, loadAnswers, toProfile } from "@/lib/profile-storage";
import { ResultCard } from "./ResultCard";

function Group({
  id,
  title,
  lead,
  matches,
  today,
}: {
  id: string;
  title: string;
  lead?: string;
  matches: BenefitMatch[];
  today: string;
}) {
  if (!matches.length) return null;
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="flex items-baseline gap-2 text-2xl font-bold">
          {title}{" "}
          <span className="rounded-full bg-fill px-2.5 text-base font-semibold text-muted tabular-nums">
            {matches.length}
          </span>
        </h2>
        {lead ? <p className="text-muted">{lead}</p> : null}
      </div>
      <ul className="grid gap-4">
        {matches.map((m) => (
          <ResultCard key={m.benefit.slug} match={m} today={today} />
        ))}
      </ul>
    </section>
  );
}

/** Evaluates the catalog in the browser: the profile never leaves the device. */
export function Results({ benefits }: { benefits: Benefit[] }) {
  const t = useTranslations("results");
  const tq = useTranslations("questionnaire");
  const [profile, setProfile] = useState<ReturnType<typeof toProfile>>();
  const [ready, setReady] = useState(false);
  const today = todayInSpain();

  useEffect(() => {
    setProfile(toProfile(loadAnswers()));
    setReady(true);
  }, []);

  const matches = useMemo(
    () => (profile ? evaluate(profile, benefits, { today }) : []),
    [profile, benefits, today],
  );
  const by = (s: BenefitMatch["status"]) => matches.filter((m) => m.status === s);
  const eligible = by("eligible");
  const almost = by("almost");
  const unknown = by("unknown");
  const notEligible = by("not_eligible");

  useEffect(() => {
    if (!profile) return;
    track({
      name: "results_shown",
      props: { eligible: eligible.length, almost: almost.length, unknown: unknown.length },
    });
  }, [profile, eligible.length, almost.length, unknown.length]);

  if (!ready) return null;

  if (!profile) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-lg">{t("noProfile")}</p>
        <Link href="/cuestionario" className={buttonVariants()}>
          {t("start")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="rise-in space-y-4">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="text-lg text-muted">{t("lead")}</p>
        <p className="text-sm text-muted">{t("estimatedTotal", { date: formatDate(today) })}</p>
        <Disclaimer />
      </header>

      <Group id="eligible" title={t("eligibleTitle")} matches={eligible} today={today} />
      {!eligible.length ? <p className="text-lg">{t("eligibleEmpty")}</p> : null}
      <Group
        id="almost"
        title={t("almostTitle")}
        lead={t("almostLead")}
        matches={almost}
        today={today}
      />
      <Group
        id="unknown"
        title={t("unknownTitle")}
        lead={t("unknownLead")}
        matches={unknown}
        today={today}
      />

      {notEligible.length ? (
        <p className="text-muted">{t("notEligibleCount", { count: notEligible.length })}</p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <BellRing aria-hidden className="size-6 text-brand-700" />
          </span>
          <div>
            <h2 className="font-semibold">{t("alertsTitle")}</h2>
            <p className="text-muted">{t("alertsBody")}</p>
          </div>
        </div>
        <Link href="/alertas" className={buttonVariants()}>
          {t("alertsCta")}
        </Link>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/cuestionario" className={buttonVariants({ variant: "secondary" })}>
          {t("editAnswers")}
        </Link>
        <Link
          href="/cuestionario"
          onClick={() => clearAnswers()}
          className={buttonVariants({ variant: "ghost" })}
        >
          {tq("restart")}
        </Link>
      </div>
    </div>
  );
}
