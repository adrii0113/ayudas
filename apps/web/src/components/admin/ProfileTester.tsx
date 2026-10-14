import { evaluate, SAMPLE_PROFILES, type Benefit } from "@tetoca/core";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";

const TONES = {
  eligible: "brand",
  almost: "warning",
  unknown: "neutral",
  not_eligible: "danger",
} as const;

/** Runs the rules engine against sample households ("Probar con perfil"). */
export async function ProfileTester({ benefit }: { benefit: Benefit }) {
  const t = await getTranslations("admin.review");
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("tester")}</h2>
      <ul className="space-y-2">
        {SAMPLE_PROFILES.map((s) => {
          const [m] = evaluate(s.profile, [benefit], { includeClosed: true });
          if (!m) return null;
          return (
            <li key={s.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span>{s.label}</span>
                <Badge tone={TONES[m.status]}>{t(`testerStatus.${m.status}`)}</Badge>
              </div>
              {m.failed.length ? (
                <p className="mt-1 text-muted">
                  {t("failed")} {m.failed.map((f) => f.label).join("; ")}
                </p>
              ) : null}
              {m.unknown.length ? (
                <p className="mt-1 text-muted">
                  {t("unknownReqs")} {m.unknown.map((f) => f.label).join("; ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
