"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteAction } from "@/app/alertas/actions";
import { Button } from "@/components/ui/button";

/** A button (not a GET link) so mail scanners prefetching links can't delete data. */
export function DeleteButton({ id, token }: { id: string; token: string }) {
  const t = useTranslations("alerts");
  const [result, setResult] = useState<boolean>();
  const [pending, start] = useTransition();
  if (result !== undefined) {
    return (
      <p role="status" className="text-lg">
        {result ? t("deleted") : t("deleteFail")}
      </p>
    );
  }
  return (
    <Button
      onClick={() => start(async () => setResult(await deleteAction(id, token)))}
      disabled={pending}
    >
      {t("deleteButton")}
    </Button>
  );
}
