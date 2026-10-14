import type { Benefit } from "@tetoca/core";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { WindowLabel } from "@/components/WindowLabel";

export function BenefitListItem({ benefit }: { benefit: Benefit }) {
  const t = useTranslations();
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge tone="brand">{t(`levels.${benefit.level}`)}</Badge>
      </div>
      <h3 className="text-lg font-semibold">
        <Link href={`/ayudas/${benefit.slug}`} className="hover:underline">
          {benefit.title}
        </Link>
      </h3>
      <p className="mt-1 text-muted">{benefit.summary}</p>
      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
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
