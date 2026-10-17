import { REGIONS } from "@tetoca/core";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { REGION_SLUGS } from "@/lib/categories";
import { SectionBand } from "./SectionBand";

/** Links to every community hub (/ayudas-en/...): navigation and internal linking. */
export function RegionLinks() {
  const t = useTranslations("region");
  return (
    <section aria-labelledby="regions">
      <SectionBand id="regions" eyebrow={t("eyebrow")} title={t("allRegions")}>
        <p className="max-w-2xl text-lg text-muted">{t("allRegionsLead")}</p>
      </SectionBand>
      <ul className="grid grid-cols-2 gap-2 py-8 sm:grid-cols-3 lg:grid-cols-4">
        {REGIONS.map((r) => (
          <li key={r.code}>
            <Link
              href={`/ayudas-en/${REGION_SLUGS[r.code]}`}
              className="pressable block rounded-xl border border-hairline bg-surface px-4 py-3 font-semibold hover:border-brand-500"
            >
              {r.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
