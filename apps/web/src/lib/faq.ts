import { describeRequirements, effectiveRules, type Benefit } from "@tetoca/core";
import { formatDate } from "./format";

type FaqItem = { question: string; answer: string };
type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * Questions people search for, answered only from the verified fields of the
 * benefit (requirements, amount, window, steps): no invented content.
 * Curated FAQs come first; derived ones fill the gaps.
 */
export function benefitFaq(benefit: Benefit, t: Translate): FaqItem[] {
  const derived: FaqItem[] = [];
  const requirements = describeRequirements(effectiveRules(benefit));
  if (requirements.length) {
    derived.push({
      question: t("who", { title: benefit.title }),
      answer: t("whoAnswer", {
        requirements: requirements.map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join("; "),
      }),
    });
  }
  derived.push({ question: t("amount"), answer: benefit.amount.text });
  const w = benefit.window;
  if (benefit.kind === "permanent" && !w?.opensAt && !w?.closesAt) {
    if (benefit.programType !== "tax_deduction" && !benefit.slug.startsWith("deduccion-")) {
      derived.push({ question: t("when"), answer: w?.text ?? t("whenPermanent") });
    }
  } else if (w?.opensAt && w.closesAt) {
    derived.push({
      question: t("when"),
      answer: t("whenDates", { opens: formatDate(w.opensAt), closes: formatDate(w.closesAt) }),
    });
  } else if (w?.closesAt) {
    derived.push({
      question: t("when"),
      answer: t("whenUntil", { closes: formatDate(w.closesAt) }),
    });
  } else if (w?.text) {
    derived.push({ question: t("when"), answer: w.text });
  }
  if (benefit.steps.length) derived.push({ question: t("how"), answer: benefit.steps.join(" ") });
  derived.push({ question: t("check"), answer: t("checkAnswer") });

  const curated = new Set(benefit.faq.map((f) => f.question.toLowerCase()));
  return [...benefit.faq, ...derived.filter((f) => !curated.has(f.question.toLowerCase()))];
}
