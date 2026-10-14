"use client";

import type { Benefit, BenefitContent } from "@tetoca/core";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  archiveAction,
  publishAction,
  saveDraftAction,
  type ActionState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const input = "min-h-10 w-full rounded-lg border-2 border-gray-300 px-3 py-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Messages({ state }: { state: ActionState }) {
  const t = useTranslations("admin.review");
  if (state.errors?.length) {
    return (
      <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">
        <p className="font-semibold">{t("invalid")}</p>
        <ul className="list-disc pl-5">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded-lg bg-brand-50 p-3">
        {t(state.ok as "saved")}
      </p>
    );
  }
  return null;
}

export function ReviewForm({ benefit, content }: { benefit: Benefit; content: BenefitContent }) {
  const t = useTranslations("admin.review");
  // Submitted manually (not as a form action) so React does not reset the
  // reviewer's edits when validation fails.
  const [state, setState] = useState<ActionState>({});
  const [saving, startSave] = useTransition();
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startSave(async () => setState(await saveDraftAction(benefit.id, {}, data)));
  };
  const [lifecycle, setLifecycle] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const run = (fn: (id: string) => Promise<ActionState>) =>
    startTransition(async () => setLifecycle(await fn(benefit.id)));

  return (
    <div className="space-y-4">
      {benefit.status === "published" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm">{t("publishedNote")}</p>
      ) : null}
      <form onSubmit={save} className="space-y-3">
        <Field label={t("fields.title")}>
          <input name="title" defaultValue={content.title} className={input} />
        </Field>
        <Field label={t("fields.summary")}>
          <textarea name="summary" defaultValue={content.summary} rows={3} className={input} />
        </Field>
        <Field label={t("fields.amountText")}>
          <input name="amountText" defaultValue={content.amount.text} className={input} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("fields.opensAt")}>
            <input name="opensAt" defaultValue={content.window?.opensAt ?? ""} className={input} />
          </Field>
          <Field label={t("fields.closesAt")}>
            <input
              name="closesAt"
              defaultValue={content.window?.closesAt ?? ""}
              className={input}
            />
          </Field>
        </div>
        <Field label={t("fields.officialUrl")}>
          <input name="officialUrl" defaultValue={content.officialUrl} className={input} />
        </Field>
        <Field label={t("fields.json")}>
          <textarea
            name="json"
            defaultValue={JSON.stringify(content, null, 2)}
            rows={24}
            spellCheck={false}
            className={`${input} font-mono text-xs`}
          />
        </Field>
        <Messages state={state} />
        <Button type="submit" disabled={saving}>
          {t("save")}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
        {benefit.status === "draft" ? (
          <Button onClick={() => run(publishAction)} disabled={pending}>
            {t("publish")}
          </Button>
        ) : null}
        {benefit.status !== "archived" ? (
          <Button variant="secondary" onClick={() => run(archiveAction)} disabled={pending}>
            {t("archive")}
          </Button>
        ) : null}
      </div>
      <Messages state={lifecycle} />
    </div>
  );
}
