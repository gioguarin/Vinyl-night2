import { describe, expect, it } from "vitest";
import { shouldSkip } from "@/lib/dedupe";

const NOW = new Date("2026-08-01T22:30:00Z");
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("shouldSkip", () => {
  it("keeps a fresh, different track", () => {
    const v = shouldSkip(
      { title: "Galaxy", artist: "War" },
      { title: "Move On Up", artist: "Curtis Mayfield", recognizedAt: minsAgo(2) },
      NOW
    );
    expect(v.skip).toBe(false);
  });

  it("skips the same track inside the window", () => {
    const v = shouldSkip(
      { title: "Move On Up (Live)", artist: "Curtis Mayfield" },
      { title: "Move On Up", artist: "Curtis Mayfield", recognizedAt: minsAgo(3) },
      NOW
    );
    expect(v).toEqual({ skip: true, reason: "duplicate" });
  });

  it("allows the same track again outside the window (played twice)", () => {
    const v = shouldSkip(
      { title: "Move On Up", artist: "Curtis Mayfield" },
      { title: "Move On Up", artist: "Curtis Mayfield", recognizedAt: minsAgo(9) },
      NOW
    );
    expect(v.skip).toBe(false);
  });

  it("skips low-confidence matches", () => {
    const v = shouldSkip({ title: "X", artist: "Y", confidence: 0.3 }, null, NOW);
    expect(v).toEqual({ skip: true, reason: "low_confidence" });
  });

  it("treats missing confidence as acceptable (AudD is binary)", () => {
    const v = shouldSkip({ title: "X", artist: "Y", confidence: null }, null, NOW);
    expect(v.skip).toBe(false);
  });

  it("handles an empty log", () => {
    expect(shouldSkip({ title: "X", artist: "Y" }, null, NOW).skip).toBe(false);
  });
});
