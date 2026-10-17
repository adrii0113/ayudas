import { deriveProgramType, getWindowStatus, todayInSpain, type Benefit } from "@tetoca/core";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";

export function WindowLabel({ benefit, today }: { benefit: Benefit; today?: string }) {
  const t = useTranslations("window");
  const status = getWindowStatus(benefit, today ?? todayInSpain());
  const { opensAt, closesAt, text } = benefit.window ?? {};
  let label: string;
  // Tax deductions are not requested: they are claimed in the income tax return.
  if (status === "permanent" && deriveProgramType(benefit) === "tax_deduction")
    label = t("taxReturn");
  else if (status === "permanent") label = t("permanent");
  else if (status === "closed") label = t("closed", { date: formatDate(closesAt!) });
  else if (status === "upcoming") label = t("upcoming", { date: formatDate(opensAt!) });
  else if (status === "open")
    label = closesAt ? t("open", { date: formatDate(closesAt) }) : t("openNoEnd");
  else label = t("unknown");
  return (
    <span>
      {label}
      {text && status !== "closed" ? (
        <span className="block text-sm text-muted">{text}</span>
      ) : null}
    </span>
  );
}
