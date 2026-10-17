import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { RegionLinks } from "@/components/RegionLinks";
import { SectionBand } from "@/components/SectionBand";
import { getPublishedBenefits } from "@/lib/catalog";

export default async function HomePage() {
  const t = await getTranslations("home");
  const benefits = await getPublishedBenefits();
  const steps = [
    { title: t("how1Title"), body: t("how1") },
    { title: t("how2Title"), body: t("how2") },
    { title: t("how3Title"), body: t("how3") },
  ];
  return (
    <div className="-mt-10">
      <section className="bleed bleed-brand relative py-20 text-center text-on-footer sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
        >
          <div className="absolute -right-40 -top-40 size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_250_231/0.18),transparent)]" />
          <div className="absolute -bottom-64 -right-20 size-[30rem] rounded-full border border-on-footer/25" />
        </div>
        <div className="rise-in relative space-y-7">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] [font-stretch:112%]">
            {t("eyebrow")}
          </p>
          <h1 className="display mx-auto max-w-5xl text-[clamp(2.75rem,8.5vw,6.5rem)]">
            {t("title")}{" "}
            <span className="accent-serif mt-3 block text-[0.5em] leading-tight">
              {t("heroAccent")}
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg font-medium sm:text-xl">{t("lead")}</p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/cuestionario"
              className="pressable inline-flex min-h-14 items-center gap-2 rounded-full bg-on-footer px-9 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.06em] text-[#bf282b] [font-stretch:112%] hover:opacity-90"
            >
              {t("cta")} <span aria-hidden>→</span>
            </Link>
            <span className="text-sm font-medium">
              {t("time")} · {t("catalogCount", { count: benefits.length })}
            </span>
          </div>
        </div>
      </section>

      <p className="mx-auto max-w-3xl py-12 text-center text-lg">{t("coverage")}</p>

      <section aria-labelledby="how">
        <SectionBand id="how" eyebrow={t("howEyebrow")} title={t("howTitle")} />
        <ol className="mx-auto max-w-3xl space-y-5 py-12">
          {steps.map(({ title, body }, i) => (
            <li key={title} className="callout space-y-1.5 p-6">
              <span className="condensed block text-sm text-brand-700">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="condensed text-2xl">{title}</h3>
              <p className="text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <RegionLinks />

      <section aria-labelledby="privacy">
        <SectionBand id="privacy" eyebrow={t("privacyEyebrow")} title={t("privacyTitle")} />
        <p className="mx-auto max-w-3xl py-12 text-lg">{t("privacy")}</p>
      </section>

      <section className="bleed bleed-brand py-14 sm:py-20">
        <div className="space-y-6 rounded-3xl bg-bg p-8 sm:p-14">
          <p className="eyebrow text-base sm:text-lg">{t("ctaEyebrow")}</p>
          <h2 className="display text-[clamp(2rem,5vw,3.5rem)]">{t("ctaTitle")}</h2>
          <p className="max-w-2xl text-lg text-muted">{t("lead")}</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href="/cuestionario" className={buttonVariants({ size: "lg" })}>
              {t("cta")} <span aria-hidden>→</span>
            </Link>
            <Link
              href="/ayudas"
              className="font-semibold text-brand-700 underline underline-offset-4"
            >
              {t("browse")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
