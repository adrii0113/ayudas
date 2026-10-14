"use server";

import { benefitContentSchema, lintRules } from "@tetoca/core";
import { archiveBenefit, getBenefitById, publishBenefit, saveDraft, toContent } from "@tetoca/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, SESSION_MAX_AGE, checkCredentials, createSession } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

export type ActionState = { ok?: string; errors?: string[]; user?: string };

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = String(form.get("user") ?? "");
  const password = String(form.get("password") ?? "");
  if (!(await checkCredentials(user, password))) return { errors: ["login"], user };
  (await cookies()).set(ADMIN_COOKIE, await createSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

function readContent(form: FormData): { content?: unknown; errors?: string[] } {
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(String(form.get("json") ?? "{}"));
  } catch (err) {
    return { errors: [`JSON: ${(err as Error).message}`] };
  }
  // Simple fields edited in the form take precedence over the JSON.
  const str = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? undefined : v;
  };
  content.title = str("title") ?? content.title;
  content.summary = str("summary") ?? content.summary;
  content.officialUrl = str("officialUrl") ?? content.officialUrl;
  content.amount = {
    ...(content.amount as object),
    text: str("amountText") ?? (content.amount as { text?: string })?.text,
  };
  const opensAt = str("opensAt");
  const closesAt = str("closesAt");
  if (opensAt || closesAt || content.window) {
    content.window = { ...(content.window as object), opensAt, closesAt };
  }
  return { content };
}

function validate(content: unknown): {
  errors: string[];
  data?: ReturnType<typeof benefitContentSchema.parse>;
} {
  const parsed = benefitContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`),
    };
  }
  return { errors: lintRules(parsed.data.eligibility), data: parsed.data };
}

export async function saveDraftAction(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const { content, errors } = readContent(form);
  if (errors) return { errors };
  const v = validate(content);
  if (v.errors.length || !v.data) return { errors: v.errors };
  const db = getDb();
  const existing = await getBenefitById(db, id);
  const draftId = await saveDraft(db, v.data, {
    draftId: id,
    sourceDocumentId: existing?.row.sourceDocumentId ?? undefined,
    extractionId: existing?.row.extractionId ?? undefined,
  });
  revalidatePath("/admin");
  if (draftId !== id) redirect(`/admin/ayudas/${draftId}`);
  return { ok: "saved" };
}

export async function publishAction(id: string): Promise<ActionState> {
  const reviewer = await requireAdmin();
  const db = getDb();
  const existing = await getBenefitById(db, id);
  if (!existing) return { errors: ["Not found"] };
  // Re-validate before publishing: never publish invalid content.
  const v = validate(toContent(existing.benefit));
  if (v.errors.length) return { errors: v.errors };
  if (JSON.stringify(existing.benefit).includes("TODO(verify)")) {
    return { errors: ["Contiene TODO(verify): verifica los datos antes de publicar."] };
  }
  await publishBenefit(db, id, reviewer);
  revalidatePath("/", "layout");
  return { ok: "published" };
}

export async function archiveAction(id: string): Promise<ActionState> {
  await requireAdmin();
  await archiveBenefit(getDb(), id);
  revalidatePath("/", "layout");
  return { ok: "archived" };
}
