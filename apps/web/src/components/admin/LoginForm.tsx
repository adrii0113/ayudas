"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const input = "min-h-11 w-full rounded-lg border-2 border-separator px-3";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="font-medium">{t("user")}</span>
        <input
          name="user"
          autoComplete="username"
          required
          defaultValue={state.user}
          className={input}
        />
      </label>
      <label className="block space-y-1">
        <span className="font-medium">{t("password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </label>
      {state.errors ? (
        <p role="alert" className="text-danger-fg">
          {t("error")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
