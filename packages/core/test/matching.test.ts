import { describe, expect, it } from "vitest";
import {
  evaluate,
  getConstants,
  getConstantsInForce,
  getRegion,
  getWindowStatus,
  todayInSpain,
} from "../src";
import { makeBenefit } from "./helpers";

describe("window status", () => {
  const call = (window: { opensAt?: string; closesAt?: string }) => ({
    kind: "call" as const,
    window,
  });

  it("handles permanent benefits", () => {
    expect(getWindowStatus({ kind: "permanent" }, "2026-01-01")).toBe("permanent");
  });

  it("is open between dates, closesAt inclusive", () => {
    const w = call({ opensAt: "2026-03-01", closesAt: "2026-03-31" });
    expect(getWindowStatus(w, "2026-02-28")).toBe("upcoming");
    expect(getWindowStatus(w, "2026-03-01")).toBe("open");
    expect(getWindowStatus(w, "2026-03-31")).toBe("open");
    expect(getWindowStatus(w, "2026-04-01")).toBe("closed");
  });

  it("is unknown without dates", () => {
    expect(getWindowStatus(call({}), "2026-03-01")).toBe("unknown");
    expect(getWindowStatus({ kind: "call" }, "2026-03-01")).toBe("unknown");
  });

  it("computes today in Spain's time zone", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Madrid.
    expect(todayInSpain(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("constants", () => {
  it("throws for unconfigured years instead of guessing", () => {
    expect(() => getConstants(1999)).toThrow();
  });

  it("uses the latest previous values when a year is not configured yet", () => {
    expect(getConstantsInForce(2030).year).toBe(2026);
    expect(getConstantsInForce(2026).iprem14).toBe(8400);
    expect(getConstantsInForce(1990).year).toBe(2026);
  });
});

describe("evaluate()", () => {
  const today = "2026-06-01";
  const state = makeBenefit({ slug: "state", title: "B estatal" });
  const regional = makeBenefit({
    slug: "regional",
    title: "A regional",
    level: "regional",
    region: "CL",
  });
  const municipal = makeBenefit({
    slug: "municipal",
    title: "C municipal",
    level: "municipal",
    region: "CL",
    municipality: "47186",
  });
  const closedCall = makeBenefit({
    slug: "closed",
    kind: "call",
    window: { opensAt: "2026-01-01", closesAt: "2026-02-01" },
  });
  const all = [state, regional, municipal, closedCall];

  it("applies region and municipality scope as hard requirements", () => {
    const results = evaluate({ region: "OTHER", applicantAge: 30 }, all, { today });
    const bySlug = Object.fromEntries(results.map((r) => [r.benefit.slug, r]));
    expect(bySlug.state?.status).toBe("eligible");
    expect(bySlug.regional?.status).toBe("not_eligible");
    expect(bySlug.regional?.failed[0]?.label).toBe("Vivir en Castilla y León");
    expect(bySlug.municipal?.status).toBe("not_eligible");
  });

  it("asks for the municipality before deciding municipal benefits", () => {
    const results = evaluate({ region: "CL", applicantAge: 30 }, all, { today });
    expect(results.find((r) => r.benefit.slug === "municipal")?.status).toBe("unknown");
    const valladolid = evaluate({ region: "CL", municipality: "47186", applicantAge: 30 }, all, {
      today,
    });
    expect(valladolid.find((r) => r.benefit.slug === "municipal")?.status).toBe("eligible");
    expect(valladolid.find((r) => r.benefit.slug === "municipal")?.met[1]?.label).toBe(
      "Estar empadronado en Valladolid",
    );
  });

  it("skips closed calls unless asked to include them", () => {
    expect(evaluate({ region: "CL" }, all, { today }).map((r) => r.benefit.slug)).not.toContain(
      "closed",
    );
    const withClosed = evaluate({ region: "CL" }, all, { today, includeClosed: true });
    expect(withClosed.find((r) => r.benefit.slug === "closed")?.window).toBe("closed");
  });

  it("sorts by status then title", () => {
    const results = evaluate({ region: "CL", municipality: "other", applicantAge: 30 }, all, {
      today,
    });
    expect(results.map((r) => r.benefit.slug)).toEqual(["regional", "state", "municipal"]);
  });

  it("works with default options (today, constants)", () => {
    expect(evaluate({ region: "CL", applicantAge: 30 }, [state])[0]?.status).toBe("eligible");
  });

  it("falls back to raw codes for unconfigured regions/municipalities", () => {
    const odd = makeBenefit({ level: "municipal", region: "ZZ", municipality: "00000" });
    const [r] = evaluate({ region: "ZZ", municipality: "1" }, [odd], { today });
    expect(r?.failed.map((f) => f.label)).toEqual(["Estar empadronado en 00000"]);
    expect(r?.met.map((f) => f.label)).toContain("Vivir en ZZ");
    expect(getRegion("CL")?.bdnsRegionId).toBe(29);
  });
});
