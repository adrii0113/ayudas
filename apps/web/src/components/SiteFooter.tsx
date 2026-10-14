import Link from "next/link";
import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted">
        <p>{t("note")}</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-4">
          <Link href="/aviso-legal" className="underline">
            {t("legal")}
          </Link>
          <Link href="/privacidad" className="underline">
            {t("privacy")}
          </Link>
          <Link href="/cookies" className="underline">
            {t("cookies")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
