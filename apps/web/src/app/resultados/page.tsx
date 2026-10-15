import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Results } from "@/components/results/Results";
import { getPublishedBenefits } from "@/lib/catalog";
import { getOpenCalls } from "@/lib/open-calls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("results");
  return { title: t("title"), robots: { index: false } };
}

export default async function ResultsPage() {
  return <Results benefits={await getPublishedBenefits()} openCalls={getOpenCalls()} />;
}
