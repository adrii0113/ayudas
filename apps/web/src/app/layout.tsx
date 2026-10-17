import type { Metadata } from "next";
import { Archivo, Open_Sans, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    openGraph: { siteName: t("siteName"), locale: "es_ES", type: "website" },
    twitter: { card: "summary_large_image" },
    // Google Search Console ownership (set once the domain is live).
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
      : {}),
  };
}

// Self-hosted at build time by next/font: no requests to Google from visitors.
const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const body = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });
const serif = Playfair_Display({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["600"],
  variable: "--font-playfair",
});

const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${serif.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
        {plausibleDomain ? (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.tagged-events.js"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
