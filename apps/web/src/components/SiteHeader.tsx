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
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-ink">
          {t("meta.siteName")}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/ayudas"
            className="pressable rounded-full px-3 py-1.5 text-[0.9375rem] font-medium text-ink hover:bg-fill"
          >
            {t("nav.benefits")}
          </Link>
          <Link
            href="/cuestionario"
            className={buttonVariants({
              className: "hidden min-h-9 px-4 py-1.5 text-[0.9375rem] sm:inline-flex",
            })}
          >
            {t("nav.start")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
