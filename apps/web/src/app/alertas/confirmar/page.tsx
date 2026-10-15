import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { confirmAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ConfirmAlertsPage({ searchParams }: Props) {
  const t = await getTranslations("alerts");
  const { token } = await searchParams;
  const ok = await confirmAction(token ?? "");
  return (
    <div className="mx-auto max-w-xl space-y-3 py-8">
      <h1 className="display text-[clamp(2.25rem,6vw,3.5rem)]">{t("confirmTitle")}</h1>
      <p role="status" className="text-lg">
        {ok ? t("confirmOk") : t("confirmFail")}
      </p>
    </div>
  );
}
