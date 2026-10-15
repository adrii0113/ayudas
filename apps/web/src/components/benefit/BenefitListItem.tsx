import type { Benefit } from "@tetoca/core";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { WindowLabel } from "@/components/WindowLabel";

export function BenefitListItem({ benefit }: { benefit: Benefit }) {
  const t = useTranslations();
  return (
    <li className="callout relative p-6 transition-[border-color,transform] duration-200 hover:border-brand-500">
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge tone="brand">{t(`levels.${benefit.level}`)}</Badge>
      </div>
      <h3 className="condensed text-xl">
        <Link
          href={`/ayudas/${benefit.slug}`}
          className="after:absolute after:inset-0 after:rounded-2xl hover:underline"
        >
          {benefit.title}
        </Link>
      </h3>
      <p className="mt-1 text-muted">{benefit.summary}</p>
      <dl className="mt-4 space-y-1 border-t border-hairline pt-4 text-sm">
        <div>
          <dt className="sr-only">{t("benefit.amount")}</dt>
          <dd className="font-medium">{benefit.amount.text}</dd>
        </div>
        <div>
          <dt className="sr-only">{t("benefit.deadline")}</dt>
          <dd className="text-muted">
            <WindowLabel benefit={benefit} />
          </dd>
        </div>
      </dl>
    </li>
  );
}
