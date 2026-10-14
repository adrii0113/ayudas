import { householdProfileSchema, type HouseholdProfile } from "@tetoca/core";

/**
 * Questionnaire answers live only in sessionStorage (cleared when the tab is
 * closed) and are never sent to the server.
 */
const KEY = "tetoca.answers.v1";

export type Answers = Partial<HouseholdProfile>;

export function loadAnswers(): Answers {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = householdProfileSchema.partial().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function saveAnswers(answers: Answers): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(answers));
}

export function clearAnswers(): void {
  window.sessionStorage.removeItem(KEY);
}

/** Answers become a profile once the region is known. */
export function toProfile(answers: Answers): HouseholdProfile | undefined {
  const parsed = householdProfileSchema.safeParse(answers);
  return parsed.success ? parsed.data : undefined;
}
