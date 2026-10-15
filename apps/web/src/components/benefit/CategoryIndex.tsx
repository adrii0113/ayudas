import type { Benefit } from "@tetoca/core";
import { useTranslations } from "next-intl";
import { SectionBand } from "@/components/SectionBand";
import { BenefitListItem } from "./BenefitListItem";

export function CategoryIndex({
  title,
  lead,
  benefits,
}: {
  title: string;
  lead: string;
  benefits: Benefit[];
}) {
  const t = useTranslations("index");
  return (
    <div className="space-y-6">
      <header className="-mt-10">
        <SectionBand as="h1" eyebrow={t("eyebrow")} title={title}>
          <p className="max-w-2xl text-lg text-muted">{lead}</p>
        </SectionBand>
      </header>
      {benefits.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {benefits.map((b) => (
            <BenefitListItem key={b.slug} benefit={b} />
          ))}
        </ul>
      ) : (
        <p>{t("empty")}</p>
      )}
    </div>
  );
}
