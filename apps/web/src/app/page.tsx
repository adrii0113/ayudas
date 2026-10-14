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
    <div className="space-y-14">
      <section className="space-y-6 pt-6 text-center sm:pt-12">
        <p className="font-medium text-brand-700">{t("eyebrow")}</p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("title")}</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted">{t("lead")}</p>
        <div className="flex flex-col items-center gap-2">
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
        <h2 id="how" className="text-2xl font-bold">
          {t("howTitle")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Card className="h-full space-y-2">
                <Icon aria-hidden className="size-7 text-brand-700" />
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-brand-50 p-6 sm:flex-row sm:items-center">
        <ShieldCheck aria-hidden className="size-10 shrink-0 text-brand-700" />
        <div>
          <h2 className="text-lg font-semibold">{t("privacyTitle")}</h2>
          <p className="text-muted">{t("privacy")}</p>
        </div>
      </section>

      <p className="text-center">
        <Link href="/ayudas" className="font-semibold text-brand-700 underline">
          {t("browse")}
        </Link>
      </p>
    </div>
  );
}
