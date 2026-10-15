import { BENEFIT_STATUSES, reviewWarnings, todayInSpain, type Benefit } from "@tetoca/core";
import { listBenefitsByStatus, listSourceDocuments } from "@tetoca/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { logoutAction } from "./actions";

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminHomePage({ searchParams }: Props) {
  await requireAdmin();
  const t = await getTranslations("admin");
  if (!process.env.DATABASE_URL) return <p role="alert">{t("noDatabase")}</p>;

  const { status: raw } = await searchParams;
  const status = (BENEFIT_STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as Benefit["status"])
    : "draft";
  const db = getDb();
  const [benefits, documents] = await Promise.all([
    listBenefitsByStatus(db, status),
    listSourceDocuments(db, 200),
  ]);
  const today = todayInSpain();
  const pendingDocs = documents.filter((d) => d.needsManualReview);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("title")} className="flex gap-2">
          {BENEFIT_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin?status=${s}`}
              aria-current={s === status ? "page" : undefined}
              className={`rounded-lg px-3 py-2 font-medium ${s === status ? "bg-brand-700 text-on-brand" : "bg-fill"}`}
            >
              {t(`status.${s}`)}
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <Button variant="secondary" type="submit">
            {t("logout")}
          </Button>
        </form>
      </div>

      {benefits.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline">
              <tr>
                <th className="py-2 pr-3">{t("columns.title")}</th>
                <th className="py-2 pr-3">{t("columns.version")}</th>
                <th className="py-2 pr-3">{t("columns.closes")}</th>
                <th className="py-2 pr-3">{t("columns.reviewed")}</th>
                <th className="py-2">{t("columns.warnings")}</th>
              </tr>
            </thead>
            <tbody>
              {benefits.map((b) => (
                <tr key={b.id} className="border-b border-hairline align-top">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/ayudas/${b.id}`} className="font-medium underline">
                      {b.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">v{b.version}</td>
                  <td className="py-2 pr-3">{b.window?.closesAt ?? "—"}</td>
                  <td className="py-2 pr-3">{b.reviewedAt ?? "—"}</td>
                  <td className="space-x-1 py-2">
                    {reviewWarnings(b, today).map((w) => (
                      <Badge key={w} tone={w === "deadline_passed" ? "danger" : "warning"}>
                        {t(`warnings.${w}`)}
                      </Badge>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("documentsTitle")}</h2>
        {pendingDocs.length ? (
          <ul className="list-disc pl-6">
            {pendingDocs.map((d) => (
              <li key={d.id}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {d.title}
                </a>{" "}
                <span className="text-muted">({d.externalId})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("documentsEmpty")}</p>
        )}
      </section>
    </div>
  );
}
