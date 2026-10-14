import { getRegion, type Benefit } from "@tetoca/core";
import { siteUrl } from "./site";

/** schema.org GovernmentService (+ FAQPage) for a benefit page. */
export function benefitJsonLd(benefit: Benefit): Record<string, unknown>[] {
  const area =
    benefit.level === "state"
      ? "España"
      : (getRegion(benefit.region ?? "")?.name ?? benefit.region);
  const service = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: benefit.title,
    description: benefit.summary,
    url: siteUrl(`/ayudas/${benefit.slug}`),
    serviceUrl: benefit.officialUrl,
    areaServed: { "@type": "AdministrativeArea", name: area },
    ...(benefit.agency
      ? { provider: { "@type": "GovernmentOrganization", name: benefit.agency } }
      : {}),
  };
  if (!benefit.faq.length) return [service];
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: benefit.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return [service, faq];
}
