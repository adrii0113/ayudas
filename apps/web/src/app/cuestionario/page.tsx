import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Questionnaire } from "@/components/questionnaire/Questionnaire";
import { getPublishedBenefits } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("questionnaire");
  return { title: t("title"), robots: { index: false } };
}

export default async function QuestionnairePage() {
  return <Questionnaire benefits={await getPublishedBenefits()} />;
}
