import type { Benefit } from "@tetoca/core";
import { useTranslations } from "next-intl";
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
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-lg text-muted">{lead}</p>
      </header>
      {benefits.length ? (
        <ul className="grid gap-4">
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
