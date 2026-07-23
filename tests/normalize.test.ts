import { describe, expect, it } from "vitest";
import { normalizePart, trackKey } from "@/lib/normalize";

describe("normalizePart", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizePart("Move On Up!")).toBe("move on up");
  });
  it("strips feat. credits", () => {
    expect(normalizePart("Freak Scene (feat. Someone)")).toBe("freak scene");
    expect(normalizePart("Song (with Guest)")).toBe("song");
  });
  it("strips remaster noise", () => {
    expect(normalizePart("Kind of Blue (2013 Remastered)")).toBe("kind of blue");
  });
  it("strips bracketed noise", () => {
    expect(normalizePart("Track [Deluxe Edition]")).toBe("track");
  });
});

describe("trackKey", () => {
  it("matches the same song across cosmetic differences", () => {
    expect(trackKey("Move On Up (Single Version)", "Curtis Mayfield")).toBe(
      trackKey("Move on up", "curtis mayfield")
    );
  });
  it("distinguishes different songs", () => {
    expect(trackKey("Move On Up", "Curtis Mayfield")).not.toBe(
      trackKey("Superfly", "Curtis Mayfield")
    );
  });
});
