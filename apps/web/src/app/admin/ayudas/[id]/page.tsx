import { type RuleNode } from "@tetoca/core";
import { getBenefitById, getExtraction, getSourceDocument, toContent } from "@tetoca/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileTester } from "@/components/admin/ProfileTester";
import { ReviewForm } from "@/components/admin/ReviewForm";
import { SourceText } from "@/components/admin/SourceText";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

function excerptsOf(node: RuleNode): string[] {
  if ("op" in node) return node.source ? [node.source.excerpt] : [];
  return [...(node.all ?? []), ...(node.any ?? [])].flatMap(excerptsOf);
}

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminReviewPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations("admin.review");
  const db = getDb();
  const found = await getBenefitById(db, id);
  if (!found) notFound();
  const { benefit, row } = found;
  const [doc, extraction] = await Promise.all([
    row.sourceDocumentId ? getSourceDocument(db, row.sourceDocumentId) : undefined,
    row.extractionId ? getExtraction(db, row.extractionId) : undefined,
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin" className="underline">
        ← {t("back")}
      </Link>
      <h1 className="text-2xl font-bold">
        {benefit.title}{" "}
        <span className="text-muted">
          (v{benefit.version}, {benefit.status})
        </span>
      </h1>
      {extraction?.uncertainties?.length ? (
        <section className="rounded-xl bg-amber-50 p-4">
          <h2 className="font-semibold">{t("uncertainties")}</h2>
          <ul className="list-disc pl-5">
            {extraction.uncertainties.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("source")}</h2>
          {doc ? (
            <>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                {doc.url}
              </a>
              <SourceText text={doc.text} excerpts={excerptsOf(benefit.eligibility)} />
            </>
          ) : (
            <div className="text-sm">
              <p>{t("noSource")}</p>
              <ul className="list-disc pl-5">
                {benefit.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      className="break-all underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.url}
                    </a>
                    {s.excerpt ? (
                      <blockquote className="text-muted">“{s.excerpt}”</blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">{t("form")}</h2>
          <ReviewForm benefit={benefit} content={toContent(benefit)} />
          <ProfileTester benefit={benefit} />
        </section>
      </div>
    </div>
  );
}
