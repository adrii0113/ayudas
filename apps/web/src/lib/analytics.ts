/**
 * Cookieless analytics (Plausible). Events carry no personal data: only which
 * benefit or how many results, never answers from the questionnaire.
 */
export type AnalyticsEvent =
  | { name: "questionnaire_started" }
  | { name: "questionnaire_completed"; props: { questions: number } }
  | { name: "results_shown"; props: { eligible: number; almost: number; unknown: number } }
  | { name: "official_link_clicked"; props: { benefit: string } }
  | { name: "alerts_subscribed" };

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void;
  }
}

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined" || !window.plausible) return;
  window.plausible(event.name, "props" in event ? { props: event.props } : undefined);
}
