import { ClipboardList, Scale, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublishedBenefits } from "@/lib/catalog";

export default async function HomePage() {
  const t = await getTranslations("home");
  const benefits = await getPublishedBenefits();
  const steps = [
    { icon: ClipboardList, title: t("how1Title"), body: t("how1") },
    { icon: Scale, title: t("how2Title"), body: t("how2") },
    { icon: Sparkles, title: t("how3Title"), body: t("how3") },
  ];
  return (
    <div className="space-y-20">
      <section className="rise-in space-y-7 pt-8 text-center sm:pt-16">
        <p className="text-[0.9375rem] font-semibold text-brand-700">{t("eyebrow")}</p>
        <h1 className="mx-auto max-w-3xl text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.05]">
          {t("title")}
        </h1>
        <p className="mx-auto max-w-2xl text-xl text-muted">{t("lead")}</p>
        <div className="flex flex-col items-center gap-3">
          <Link href="/cuestionario" className={buttonVariants({ size: "lg" })}>
            {t("cta")}
          </Link>
          <span className="text-sm text-muted">
            {t("time")} · {t("catalogCount", { count: benefits.length })}
          </span>
        </div>
        <p className="text-sm text-muted">{t("coverage")}</p>
      </section>

      <section aria-labelledby="how" className="space-y-6">
        <h2 id="how" className="text-3xl font-bold">
          {t("howTitle")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Card className="h-full space-y-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50">
                  <Icon aria-hidden className="size-6 text-brand-700" />
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50">
          <ShieldCheck aria-hidden className="size-8 text-brand-700" />
        </span>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t("privacyTitle")}</h2>
          <p className="text-muted">{t("privacy")}</p>
        </div>
      </section>

      <p className="text-center">
        <Link
          href="/ayudas"
          className="text-lg font-semibold text-brand-700 underline-offset-4 hover:underline"
        >
          {t("browse")} <span aria-hidden>→</span>
        </Link>
      </p>
    </div>
  );
}
