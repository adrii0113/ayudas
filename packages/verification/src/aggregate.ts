import type { TrustLevel } from "@tetoca/core";
import type { Verdict } from "./types";

/**
 * Agents that must all pass for a record to become `agent_verified`. The rest
 * (deadlines, source-consistency, parameters) only need not to fail: they are
 * skipped when they do not apply (e.g. a permanent benefit has no deadline).
 */
export const REQUIRED_AGENTS = ["citations", "quote-check", "second-extraction", "links"] as const;

export type Decision = {
  trustLevel: TrustLevel;
  /** A person should look at it (any failure or doubt). */
  needsHumanReview: boolean;
  reasons: string[];
};

/**
 * - any `fail` → down to `extracted` (a human sign-off is kept, but flagged);
 * - any `uncertain` → no automatic trust (agent_verified drops to extracted);
 * - every required agent `pass` and nothing else failing → `agent_verified`;
 * - otherwise (e.g. no LLM configured) → unchanged.
 */
export function decide(current: TrustLevel, verdicts: Record<string, Verdict>): Decision {
  const failed = Object.entries(verdicts)
    .filter(([, v]) => v === "fail")
    .map(([a]) => a);
  const doubtful = Object.entries(verdicts)
    .filter(([, v]) => v === "uncertain")
    .map(([a]) => a);
  const keepHuman = current === "human_verified";

  if (failed.length) {
    return {
      trustLevel: keepHuman ? "human_verified" : "extracted",
      needsHumanReview: true,
      reasons: failed.map((a) => `${a}: fail`),
    };
  }
  if (doubtful.length) {
    return {
      trustLevel: keepHuman
        ? "human_verified"
        : current === "agent_verified"
          ? "extracted"
          : current,
      needsHumanReview: true,
      reasons: doubtful.map((a) => `${a}: uncertain`),
    };
  }
  const missing = REQUIRED_AGENTS.filter((a) => verdicts[a] !== "pass");
  if (!missing.length) {
    return {
      trustLevel: keepHuman ? "human_verified" : "agent_verified",
      needsHumanReview: false,
      reasons: [],
    };
  }
  return {
    trustLevel: current,
    needsHumanReview: false,
    reasons: missing.map((a) => `${a}: ${verdicts[a] ?? "not run"}`),
  };
}
