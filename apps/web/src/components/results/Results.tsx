"use client";

import { evaluate, todayInSpain, type Benefit, type BenefitMatch } from "@tetoca/core";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { SectionBand } from "@/components/SectionBand";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import { clearAnswers, loadAnswers, toProfile } from "@/lib/profile-storage";
import { OpenCalls } from "./OpenCalls";
import { ResultCard } from "./ResultCard";
import type { OpenCallsData } from "@/lib/open-calls";

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
    <section aria-labelledby={id} className="space-y-5">
      <div>
        <h2 id={id} className="display text-[clamp(1.75rem,4vw,2.5rem)]">
          {title}{" "}
          <span className="condensed ml-1 inline-block rounded-full bg-brand-500 px-3 py-0.5 align-middle text-lg text-on-footer tabular-nums">
            {matches.length}
          </span>
        </h2>
        {lead ? <p className="mt-2 text-lg text-muted">{lead}</p> : null}
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
export function Results({ benefits, openCalls }: { benefits: Benefit[]; openCalls: OpenCallsData }) {
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
      <header className="-mt-10">
        <SectionBand as="h1" eyebrow={t("eyebrow")} title={t("title")}>
          <p className="max-w-2xl text-lg text-muted">{t("lead")}</p>
          <p className="text-sm text-muted">{t("estimatedTotal", { date: formatDate(today) })}</p>
        </SectionBand>
        <div className="mt-8">
          <Disclaimer />
        </div>
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

      <OpenCalls data={openCalls} region={profile.region} today={today} />

      {notEligible.length ? (
        <p className="text-muted">{t("notEligibleCount", { count: notEligible.length })}</p>
      ) : null}

      <section className="bleed bleed-brand py-12">
        <div className="space-y-5 rounded-3xl bg-bg p-8 sm:p-12">
          <p className="eyebrow flex items-center gap-2 text-sm">
            <BellRing aria-hidden className="size-4" /> {t("alertsEyebrow")}
          </p>
          <h2 className="display text-[clamp(1.75rem,4vw,2.75rem)]">{t("alertsTitle")}</h2>
          <p className="max-w-2xl text-lg text-muted">{t("alertsBody")}</p>
          <Link href="/alertas" className={buttonVariants({ size: "lg" })}>
            {t("alertsCta")} <span aria-hidden>→</span>
          </Link>
        </div>
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
