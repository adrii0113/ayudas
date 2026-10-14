import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "./ui/button";

export function SiteHeader() {
  const t = useTranslations();
  return (
    <header className="border-b border-gray-200 bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-brand-700">
          {t("meta.siteName")}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-3">
          <Link href="/ayudas" className="rounded-lg px-2 py-2 font-medium hover:bg-gray-100">
            {t("nav.benefits")}
          </Link>
          <Link
            href="/cuestionario"
            className={buttonVariants({ size: "md", className: "hidden sm:inline-flex" })}
          >
            {t("nav.start")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
