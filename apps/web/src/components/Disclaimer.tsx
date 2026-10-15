import { useTranslations } from "next-intl";

export function Disclaimer() {
  const t = useTranslations("disclaimer");
  return (
    <aside role="note" className="callout space-y-1 p-5">
      <p className="eyebrow">{t("title")}</p>
      <p>{t("body")}</p>
    </aside>
  );
}
