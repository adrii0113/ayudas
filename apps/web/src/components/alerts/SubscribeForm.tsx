"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { subscribeAction } from "@/app/alertas/actions";
import { buttonVariants, Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { loadAnswers, toProfile } from "@/lib/profile-storage";

export function SubscribeForm() {
  const t = useTranslations("alerts");
  const [profile, setProfile] = useState<string | null>();
  const [state, action, pending] = useActionState(subscribeAction, {});

  useEffect(() => {
    const p = toProfile(loadAnswers());
    setProfile(p ? JSON.stringify(p) : null);
  }, []);

  useEffect(() => {
    if (state.status === "sent") track({ name: "alerts_subscribed" });
  }, [state.status]);

  if (profile === undefined) return null;
  if (profile === null) {
    return (
      <div className="space-y-3">
        <p>{t("needProfile")}</p>
        <Link href="/cuestionario" className={buttonVariants()}>
          {t("startQuestionnaire")}
        </Link>
      </div>
    );
  }
  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl bg-brand-50 p-4 text-lg">
        {t("sent")}
      </p>
    );
  }

  const error = state.status ? t(state.status) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile" value={profile} />
      <div aria-hidden className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="font-medium">{t("email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="min-h-12 w-full max-w-md rounded-xl border-2 border-gray-300 px-3 text-lg"
        />
      </label>
      <label className="flex max-w-xl items-start gap-3">
        <input type="checkbox" name="consent" required className="mt-1 size-5 accent-brand-700" />
        <span>
          {t("consent")}{" "}
          <Link href="/privacidad" className="underline">
            {t("privacyLink")}
          </Link>
          .
        </span>
      </label>
      <p className="text-sm text-muted">{t("whatWeStore")}</p>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
