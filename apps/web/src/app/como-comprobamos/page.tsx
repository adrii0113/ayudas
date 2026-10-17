import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("methodology");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/como-comprobamos" },
  };
}

const SECTIONS = [
  "sources",
  "rules",
  "checks",
  "human",
  "unverified",
  "eligibility",
  "errors",
] as const;

export default async function MethodologyPage() {
  const t = await getTranslations("methodology");
  return (
    <LegalPage title={t("title")}>
      <p>{t("intro")}</p>
      {SECTIONS.map((s) => (
        <section key={s} className="space-y-2">
          <h2>{t(`${s}Title`)}</h2>
          <p>{t(s)}</p>
        </section>
      ))}
    </LegalPage>
  );
}
