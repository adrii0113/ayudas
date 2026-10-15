import Link from "next/link";
import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="mt-20 border-t border-hairline">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-10 text-sm text-muted">
        <p className="max-w-2xl">{t("note")}</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/aviso-legal" className="underline-offset-4 hover:text-ink hover:underline">
            {t("legal")}
          </Link>
          <Link href="/privacidad" className="underline-offset-4 hover:text-ink hover:underline">
            {t("privacy")}
          </Link>
          <Link href="/cookies" className="underline-offset-4 hover:text-ink hover:underline">
            {t("cookies")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
