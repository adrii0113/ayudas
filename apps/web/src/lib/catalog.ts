import "server-only";
import type { Benefit, BenefitCategory } from "@tetoca/core";
import { cache } from "react";
import catalogJson from "@/generated/catalog.json";

/**
 * Published benefits. With DATABASE_URL set they come from Postgres (reviewed in
 * /admin); otherwise from the curated YAML catalog compiled at build time.
 */
export const getPublishedBenefits = cache(async (): Promise<Benefit[]> => {
  if (process.env.DATABASE_URL) {
    const { getDb } = await import("./db");
    const { listPublishedBenefits } = await import("@tetoca/db");
    return listPublishedBenefits(getDb());
  }
  return catalogJson as unknown as Benefit[];
});

export async function getBenefitBySlug(slug: string): Promise<Benefit | undefined> {
  return (await getPublishedBenefits()).find((b) => b.slug === slug);
}

export async function getBenefitsByCategory(
  category: BenefitCategory,
  region?: string,
): Promise<Benefit[]> {
  return (await getPublishedBenefits()).filter(
    (b) => b.category === category && (b.level === "state" || !region || b.region === region),
  );
}
