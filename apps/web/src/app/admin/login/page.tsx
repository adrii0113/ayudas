import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/admin/LoginForm";
import { adminConfigured } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const t = await getTranslations("admin.login");
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {adminConfigured() ? <LoginForm /> : <p role="alert">{t("notConfigured")}</p>}
    </div>
  );
}
