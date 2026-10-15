"use client";

import type { ChildInfo, HouseholdProfile, Question, QuestionInput } from "@tetoca/core";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Answers = Partial<HouseholdProfile>;

export type InputProps<T extends QuestionInput["type"]> = {
  question: Question & { input: Extract<QuestionInput, { type: T }> };
  answers: Answers;
  onSubmit: (patch: Answers) => void;
  submitLabel: string;
};

function OptionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "pressable flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-5 py-3 text-left text-lg font-medium",
        selected
          ? "border-2 border-brand-500 bg-brand-50"
          : "border-2 border-hairline bg-surface hover:border-brand-500",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-150",
          selected
            ? "bg-brand-500 text-on-footer"
            : "shadow-[inset_0_0_0_1.5px_var(--color-separator)]",
        )}
      >
        {selected ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/** True if every field set by the option matches the current answers. */
function isSelected(set: Answers, answers: Answers) {
  return Object.entries(set).every(([k, v]) => answers[k as keyof Answers] === v);
}

export function ChoiceInput({ question, answers, onSubmit }: InputProps<"choice">) {
  const t = useTranslations(`questionnaire.questions.${question.id}`);
  return (
    <div role="radiogroup" aria-labelledby="question-title" className="grid gap-3">
      {question.input.options.map((o) => (
        <OptionButton
          key={o.value}
          selected={isSelected(o.set, answers)}
          onClick={() => onSubmit(o.set)}
        >
          {t(`options.${o.value}`)}
        </OptionButton>
      ))}
    </div>
  );
}

export function YesNoInput({ question, answers, onSubmit }: InputProps<"yesNo">) {
  const t = useTranslations("questionnaire");
  const field = question.input.field;
  return (
    <div role="radiogroup" aria-labelledby="question-title" className="grid gap-3 sm:grid-cols-2">
      <OptionButton selected={answers[field] === true} onClick={() => onSubmit({ [field]: true })}>
        {t("yes")}
      </OptionButton>
      <OptionButton
        selected={answers[field] === false}
        onClick={() => onSubmit({ [field]: false })}
      >
        {t("no")}
      </OptionButton>
    </div>
  );
}

function parseNumber(value: string): number | undefined {
  const normalised = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalised) return undefined;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : undefined;
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  describedBy,
  invalid,
  hideLabel,
}: {
  hideLabel?: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "block font-medium"}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="min-h-13 w-44 rounded-xl border border-separator bg-surface px-4 text-lg tabular-nums transition-[border-color,box-shadow] duration-150 focus:border-brand-700 focus:shadow-[0_0_0_3px_var(--color-brand-100)] focus:outline-none"
        />
        {unit ? <span className="text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}

export function NumberInput({ question, answers, onSubmit, submitLabel }: InputProps<"number">) {
  const t = useTranslations("questionnaire");
  const { field, min, max, unit } = question.input;
  const current = answers[field];
  const [value, setValue] = useState(typeof current === "number" ? String(current) : "");
  const [error, setError] = useState<string>();
  const errorId = useId();
  // Household size can't be smaller than the applicant plus their children.
  const minimum =
    field === "householdSize" ? Math.max(min, (answers.children?.length ?? 0) + 1) : min;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseNumber(value);
    if (n === undefined || n < minimum || n > max) {
      setError(
        field === "householdSize" && n !== undefined && n < minimum
          ? t("questions.householdSize.tooFew", { min: minimum })
          : t("invalidNumber", { min: minimum, max }),
      );
      return;
    }
    onSubmit({ [field]: unit === "euros_month" ? n : Math.round(n) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <NumberField
        label={t(`questions.${question.id}.title`)}
        hideLabel
        value={value}
        onChange={setValue}
        unit={unit ? t(`units.${unit}`) : undefined}
        describedBy={error ? errorId : undefined}
        invalid={!!error}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-danger-fg">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}

export function IncomeInput({ answers, onSubmit, submitLabel }: InputProps<"income">) {
  const t = useTranslations("questionnaire");
  const tq = useTranslations("questionnaire.questions.annualHouseholdIncome");
  const initial = answers.annualHouseholdIncome;
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [value, setValue] = useState(initial !== undefined ? String(Math.round(initial / 12)) : "");
  const [error, setError] = useState<string>();
  const errorId = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseNumber(value);
    if (n === undefined || n < 0 || n > 1_000_000) {
      setError(t("invalidNumber", { min: 0, max: "1.000.000" }));
      return;
    }
    onSubmit({ annualHouseholdIncome: period === "month" ? n * 12 : n });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="font-medium">{tq("amount")}</legend>
        <div className="inline-flex rounded-full bg-fill p-1">
          {(["month", "year"] as const).map((p) => (
            <label
              key={p}
              className={cn(
                "pressable relative cursor-pointer rounded-full px-5 py-2 font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600",
                period === p ? "bg-ink text-bg" : "text-muted hover:text-ink",
              )}
            >
              <input
                type="radio"
                name="period"
                checked={period === p}
                onChange={() => setPeriod(p)}
                className="sr-only"
              />
              {p === "month" ? tq("perMonth") : tq("perYear")}
            </label>
          ))}
        </div>
      </fieldset>
      <NumberField
        label={tq("amount")}
        value={value}
        onChange={setValue}
        unit={period === "month" ? "€ / mes" : "€ / año"}
        describedBy={error ? errorId : undefined}
        invalid={!!error}
      />
      {period === "month" ? <p className="text-sm text-muted">{tq("monthlyNote")}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-danger-fg">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}

export function ChildrenInput({ answers, onSubmit, submitLabel }: InputProps<"children">) {
  const t = useTranslations("questionnaire");
  const tq = useTranslations("questionnaire.questions.children");
  const [count, setCount] = useState(answers.children?.length ?? 0);
  const [ages, setAges] = useState<string[]>(answers.children?.map((c) => String(c.age)) ?? []);
  const [disabled, setDisabled] = useState<boolean[]>(
    answers.children?.map((c) => (c.disabilityPercent ?? 0) >= 33) ?? [],
  );
  const [error, setError] = useState<string>();

  const setCountClamped = (n: number) => {
    const c = Math.max(0, Math.min(15, n));
    setCount(c);
    setAges((prev) => Array.from({ length: c }, (_, i) => prev[i] ?? ""));
    setDisabled((prev) => Array.from({ length: c }, (_, i) => prev[i] ?? false));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ages.slice(0, count).map(parseNumber);
    if (parsed.some((a) => a === undefined || a < 0 || a > 30)) {
      setError(t("invalidNumber", { min: 0, max: 30 }));
      return;
    }
    const children: ChildInfo[] = (parsed as number[]).map((age, i) => ({
      age: Math.floor(age),
      // Generic yes/no only: we never ask for the exact percentage.
      disabilityPercent: disabled[i] ? 33 : 0,
    }));
    onSubmit({ children });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1">
        <span id="children-count" className="block font-medium">
          {tq("count")}
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="children-count">
          <Button
            type="button"
            variant="secondary"
            className="size-12 p-0 text-2xl"
            aria-label="−1"
            onClick={() => setCountClamped(count - 1)}
          >
            −
          </Button>
          <output
            aria-live="polite"
            className="w-10 text-center text-3xl font-semibold tabular-nums"
          >
            {count}
          </output>
          <Button
            type="button"
            variant="secondary"
            className="size-12 p-0 text-2xl"
            aria-label="+1"
            onClick={() => setCountClamped(count + 1)}
          >
            +
          </Button>
        </div>
      </div>
      {count > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{tq("ageHelp")}</p>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="rise-in callout space-y-3 p-4">
              <NumberField
                label={tq("age", { n: i + 1 })}
                value={ages[i] ?? ""}
                onChange={(v) => setAges((prev) => prev.map((a, j) => (j === i ? v : a)))}
                unit={t("units.years")}
              />
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={disabled[i] ?? false}
                  onChange={(e) =>
                    setDisabled((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                  }
                  className="size-5 accent-brand-700"
                />
                {tq("disability")}
              </label>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger-fg">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
