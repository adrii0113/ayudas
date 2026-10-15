import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <Link href="/admin" className="text-lg font-bold">
          {t("title")}
        </Link>
      </div>
      {children}
    </div>
  );
}
