import Link from "next/link";
import { useTranslations } from "next-intl";

const linkClass = "underline underline-offset-4 hover:text-brand-100";

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-24 bg-footer text-on-footer">
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="space-y-3">
            <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.14em]">
              {t("footer.exploreTitle")}
            </h2>
            <ul className="space-y-1.5">
              <li>
                <Link href="/" className={linkClass}>
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link href="/ayudas" className={linkClass}>
                  {t("nav.benefits")}
                </Link>
              </li>
              <li>
                <Link href="/alertas" className={linkClass}>
                  {t("nav.alerts")}
                </Link>
              </li>
            </ul>
          </div>
          <nav aria-label={t("footer.legalTitle")} className="space-y-3">
            <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.14em]">
              {t("footer.legalTitle")}
            </h2>
            <ul className="space-y-1.5">
              <li>
                <Link href="/aviso-legal" className={linkClass}>
                  {t("footer.legal")}
                </Link>
              </li>
              <li>
                <Link href="/privacidad" className={linkClass}>
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/cookies" className={linkClass}>
                  {t("footer.cookies")}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="space-y-4">
            <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.14em]">
              {t("footer.startTitle")}
            </h2>
            <p className="accent-serif text-2xl leading-snug">{t("footer.note")}</p>
            <Link
              href="/cuestionario"
              className="pressable inline-flex min-h-11 items-center rounded-full bg-on-footer px-6 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.06em] text-[#bf282b] [font-stretch:112%] hover:opacity-90"
            >
              {t("nav.start")}
            </Link>
          </div>
        </div>

        <p
          aria-hidden
          className="display border-y border-on-footer/20 py-8 text-[clamp(2.5rem,10vw,7.5rem)] leading-[0.9]"
        >
          {t("footer.wordmarkStart")}{" "}
          <span className="accent-serif">{t("footer.wordmarkAccent")}</span>{" "}
          {t("footer.wordmarkEnd")}
        </p>

        <div className="flex flex-col justify-between gap-2 text-xs uppercase tracking-[0.1em] sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t("meta.siteName")}
          </p>
          <p>{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
  );
}
