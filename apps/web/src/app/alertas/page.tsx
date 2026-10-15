import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SubscribeForm } from "@/components/alerts/SubscribeForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("alerts");
  return { title: t("title"), description: t("lead") };
}

export default async function AlertsPage() {
  const t = await getTranslations("alerts");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="display text-[clamp(2.25rem,6vw,3.5rem)]">{t("title")}</h1>
        <p className="text-lg text-muted">{t("lead")}</p>
      </header>
      <SubscribeForm />
    </div>
  );
}
