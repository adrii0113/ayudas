"use client";

import {
  finalizeAnswers,
  selectQuestions,
  type Benefit,
  type HouseholdProfile,
  type Question,
} from "@tetoca/core";
import { ArrowLeft, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { loadAnswers, saveAnswers } from "@/lib/profile-storage";
import {
  ChildrenInput,
  ChoiceInput,
  IncomeInput,
  NumberInput,
  YesNoInput,
  type InputProps,
} from "./inputs";

type Answers = Partial<HouseholdProfile>;

function QuestionInputView(props: InputProps<Question["input"]["type"]>) {
  // Keyed by question id so local input state resets between questions.
  switch (props.question.input.type) {
    case "choice":
      return <ChoiceInput {...(props as InputProps<"choice">)} />;
    case "yesNo":
      return <YesNoInput {...(props as InputProps<"yesNo">)} />;
    case "number":
      return <NumberInput {...(props as InputProps<"number">)} />;
    case "income":
      return <IncomeInput {...(props as InputProps<"income">)} />;
    case "children":
      return <ChildrenInput {...(props as InputProps<"children">)} />;
  }
}

/**
 * Adaptive questionnaire: one question per screen, only the questions some
 * active benefit needs. Answers stay in sessionStorage (never sent anywhere).
 */
export function Questionnaire({ benefits }: { benefits: Benefit[] }) {
  const t = useTranslations("questionnaire");
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [currentId, setCurrentId] = useState<string>();
  const [ready, setReady] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setAnswers(loadAnswers());
    setReady(true);
    track({ name: "questionnaire_started" });
  }, []);

  const questions = useMemo(() => selectQuestions(benefits, answers), [benefits, answers]);
  const index = Math.max(
    0,
    questions.findIndex((q) => q.id === currentId),
  );
  const question = questions[index];

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    if (ready && currentId) headingRef.current?.focus();
  }, [currentId, ready]);

  if (!ready || !question) return null;

  const submit = (patch: Answers) => {
    const next = { ...answers, ...patch };
    const nextQuestions = selectQuestions(benefits, next);
    const pos = nextQuestions.findIndex((q) => q.id === question.id);
    const following = nextQuestions[pos + 1];
    setAnswers(next);
    if (following) {
      saveAnswers(next);
      setDirection("forward");
      setCurrentId(following.id);
      return;
    }
    saveAnswers(finalizeAnswers(next));
    track({ name: "questionnaire_completed", props: { questions: nextQuestions.length } });
    router.push("/resultados");
  };

  const back = () => {
    const previous = questions[index - 1];
    if (!previous) return;
    setDirection("back");
    setCurrentId(previous.id);
  };

  const isLast = index === questions.length - 1;
  const help = t.has(`questions.${question.id}.help`) ? t(`questions.${question.id}.help`) : null;

  const progressLabel = t("progress", { current: index + 1, total: questions.length });

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-3">
        <div className="flex min-h-9 items-center justify-between text-sm text-muted">
          <span>{progressLabel}</span>
          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              className="pressable inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium text-brand-700 hover:bg-fill"
            >
              <ArrowLeft aria-hidden className="size-4" /> {t("back")}
            </button>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={index + 1}
          className="h-1.5 w-full overflow-hidden rounded-full bg-fill-strong"
        >
          <div
            className="h-full origin-left rounded-full bg-brand-700 transition-transform duration-500 ease-spring"
            style={{ transform: `scaleX(${(index + 1) / questions.length})` }}
          />
        </div>
      </div>

      <section
        key={question.id}
        aria-labelledby="question-title"
        className={`space-y-6 ${direction === "forward" ? "step-forward" : "step-back"}`}
      >
        <div className="space-y-2">
          <h1
            id="question-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-bold outline-none sm:text-4xl"
          >
            {t(`questions.${question.id}.title`)}
          </h1>
          {help ? <p className="text-lg text-muted">{help}</p> : null}
        </div>
        <QuestionInputView
          question={question}
          answers={answers}
          onSubmit={submit}
          submitLabel={isLast ? t("finish") : t("next")}
        />
      </section>

      <p className="flex items-center gap-2 text-sm text-muted">
        <Lock aria-hidden className="size-4" /> {t("privacy")}
      </p>
    </div>
  );
}
