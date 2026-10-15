import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "./ui/button";

export function SiteHeader() {
  const t = useTranslations();
  return (
    <header className="material-bar sticky top-0 z-40 shadow-[0_1px_0_var(--color-hairline)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
        <Link href="/" className="display text-2xl text-brand-700 sm:text-3xl">
          {t("meta.siteName")}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-2 sm:gap-6">
          <Link
            href="/ayudas"
            className="pressable rounded-full px-3 py-2 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.08em] text-ink [font-stretch:112%] hover:text-brand-700"
          >
            {t("nav.benefits")}
          </Link>
          <Link
            href="/cuestionario"
            className={buttonVariants({ className: "hidden sm:inline-flex" })}
          >
            {t("nav.start")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
