import { describe, expect, it } from "vitest";
import { buildSearchQuery, chunk } from "@/lib/spotify";

describe("buildSearchQuery", () => {
  it("prefers ISRC when present", () => {
    expect(buildSearchQuery({ isrc: "USRC17607839", title: "T", artist: "A" })).toBe(
      "isrc:USRC17607839"
    );
  });
  it("falls back to track/artist filters", () => {
    expect(buildSearchQuery({ title: "Move On Up", artist: "Curtis Mayfield" })).toBe(
      "track:Move On Up artist:Curtis Mayfield"
    );
  });
});

describe("chunk", () => {
  it("splits into batches of 100 for the playlist add endpoint", () => {
    const parts = chunk(Array.from({ length: 205 }, (_, i) => i), 100);
    expect(parts.map((p) => p.length)).toEqual([100, 100, 5]);
  });
  it("handles empty input", () => {
    expect(chunk([], 100)).toEqual([]);
  });
});
