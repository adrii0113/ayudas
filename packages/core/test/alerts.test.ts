import { describe, expect, it } from "vitest";
import { selectAlertMatches } from "../src";
import { makeBenefit } from "./helpers";

const profile = { region: "CL", applicantAge: 30 };
const now = new Date("2026-10-14T08:00:00Z");
const fresh = makeBenefit({ id: "a", slug: "a", reviewedAt: "2026-10-10" });
const old = makeBenefit({ id: "b", slug: "b", reviewedAt: "2026-01-01" });
const reopened = makeBenefit({
  id: "c",
  slug: "c",
  reviewedAt: "2025-12-01",
  kind: "call",
  window: { opensAt: "2026-10-12", closesAt: "2026-12-31" },
});
const notMatching = makeBenefit({
  id: "d",
  slug: "d",
  reviewedAt: "2026-10-10",
  eligibility: { all: [{ field: "applicantAge", op: "gte", value: 65, label: "65+", hard: true }] },
});
const draft = makeBenefit({ id: "e", slug: "e", status: "draft", reviewedAt: "2026-10-10" });

const base = {
  profile,
  benefits: [fresh, old, reopened, notMatching, draft],
  notified: new Set<string>(),
  since: new Date("2026-10-01T00:00:00Z"),
  lastSentAt: null,
  now,
};

describe("selectAlertMatches", () => {
  it("returns new or reopened published benefits that match", () => {
    expect(
      selectAlertMatches(base)
        .map((m) => m.benefit.id)
        .sort(),
    ).toEqual(["a", "c"]);
  });

  it("never repeats a benefit already notified", () => {
    expect(
      selectAlertMatches({ ...base, notified: new Set(["a"]) }).map((m) => m.benefit.id),
    ).toEqual(["c"]);
  });

  it("sends at most one email per week", () => {
    expect(selectAlertMatches({ ...base, lastSentAt: new Date("2026-10-10T08:00:00Z") })).toEqual(
      [],
    );
    expect(
      selectAlertMatches({ ...base, lastSentAt: new Date("2026-10-07T08:00:00Z") }),
    ).toHaveLength(2);
  });
});
