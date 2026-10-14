import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

export function Disclaimer() {
  const t = useTranslations("disclaimer");
  return (
    <aside
      role="note"
      className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
    >
      <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p>
        <strong>{t("title")}.</strong> {t("body")}
      </p>
    </aside>
  );
}
