import { BENEFIT_CATEGORIES } from "@tetoca/core";
import type { MetadataRoute } from "next";
import { getPublishedBenefits } from "@/lib/catalog";
import { CATEGORY_SLUGS, REGION_SLUGS } from "@/lib/categories";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const benefits = await getPublishedBenefits();
  const staticPages = ["", "/ayudas", "/cuestionario", "/alertas", "/como-comprobamos"].map(
    (p) => ({
      url: siteUrl(p),
      changeFrequency: "weekly" as const,
    }),
  );
  const categories = BENEFIT_CATEGORIES.flatMap((c) => [
    { url: siteUrl(`/ayudas/${CATEGORY_SLUGS[c]}`), changeFrequency: "weekly" as const },
    ...Object.values(REGION_SLUGS).map((r) => ({
      url: siteUrl(`/ayudas/${CATEGORY_SLUGS[c]}/${r}`),
      changeFrequency: "weekly" as const,
    })),
  ]);
  const regions = Object.values(REGION_SLUGS).map((r) => ({
    url: siteUrl(`/ayudas-en/${r}`),
    changeFrequency: "daily" as const,
  }));
  const pages = benefits.map((b) => ({
    url: siteUrl(`/ayudas/${b.slug}`),
    lastModified: b.verifiedAt ?? b.reviewedAt,
    changeFrequency: "weekly" as const,
  }));
  return [...staticPages, ...regions, ...categories, ...pages];
}
