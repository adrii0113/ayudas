import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/alerts/DeleteButton";

export const metadata: Metadata = { robots: { index: false } };

type Props = { searchParams: Promise<{ id?: string; token?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const t = await getTranslations("alerts");
  const { id = "", token = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-4 py-8">
      <h1 className="text-3xl font-bold">{t("deleteTitle")}</h1>
      <p>{t("deleteBody")}</p>
      <DeleteButton id={id} token={token} />
    </div>
  );
}
