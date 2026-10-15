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
      <header className="rise-in space-y-3">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="text-xl text-muted">{lead}</p>
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
