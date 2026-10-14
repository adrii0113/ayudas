import { describe, expect, it } from "vitest";
import { householdProfileSchema, reviewWarnings, SAMPLE_PROFILES } from "../src";
import { makeBenefit } from "./helpers";

describe("reviewWarnings", () => {
  it("proposes archiving published calls whose deadline passed", () => {
    const call = makeBenefit({ kind: "call", window: { closesAt: "2026-01-30" } });
    expect(reviewWarnings(call, "2026-02-01")).toContain("deadline_passed");
    expect(reviewWarnings(call, "2026-01-30")).not.toContain("deadline_passed");
  });

  it("flags benefits not reviewed in the last 12 months", () => {
    const b = makeBenefit({ reviewedAt: "2025-10-14" });
    expect(reviewWarnings(b, "2026-10-13")).toEqual([]);
    expect(reviewWarnings(b, "2026-10-14")).toEqual(["stale_review"]);
    expect(reviewWarnings(makeBenefit({ reviewedAt: undefined }), "2026-10-14")).toContain(
      "stale_review",
    );
  });

  it("flags AI-curated benefits pending human review, and ignores drafts", () => {
    expect(reviewWarnings(makeBenefit({ reviewedBy: "claude-code" }), "2026-10-14")).toEqual([
      "pending_human_review",
    ]);
    expect(
      reviewWarnings(makeBenefit({ status: "draft", reviewedAt: undefined }), "2030-01-01"),
    ).toEqual([]);
  });

  it("ships valid sample profiles", () => {
    for (const s of SAMPLE_PROFILES)
      expect(householdProfileSchema.safeParse(s.profile).success, s.id).toBe(true);
  });
});
