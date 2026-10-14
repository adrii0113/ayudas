import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("body")}</p>
      <Link href="/ayudas" className="font-semibold text-brand-700 underline">
        {t("back")}
      </Link>
    </div>
  );
}
