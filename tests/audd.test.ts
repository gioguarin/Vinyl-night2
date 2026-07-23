import { describe, expect, it } from "vitest";
import { parseAuddResponse } from "@/lib/recognition/audd";

describe("parseAuddResponse", () => {
  it("maps a full result", () => {
    const m = parseAuddResponse({
      status: "success",
      result: {
        title: "Strings of Life",
        artist: "Rhythim Is Rhythim",
        album: "Strings of Life",
        isrc: "USXXX8700001",
        spotify: { id: "abc123", album: { images: [{ url: "https://img/cover.jpg" }] } },
      },
    });
    expect(m).toMatchObject({
      title: "Strings of Life",
      artist: "Rhythim Is Rhythim",
      isrc: "USXXX8700001",
      spotifyId: "abc123",
      artworkUrl: "https://img/cover.jpg",
      provider: "audd",
    });
  });

  it("falls back to Apple Music artwork with size template", () => {
    const m = parseAuddResponse({
      status: "success",
      result: {
        title: "T",
        artist: "A",
        apple_music: { artwork: { url: "https://img/{w}x{h}.jpg" } },
      },
    });
    expect(m?.artworkUrl).toBe("https://img/500x500.jpg");
  });

  it("returns null when nothing matched", () => {
    expect(parseAuddResponse({ status: "success", result: null })).toBeNull();
  });

  it("throws on API errors", () => {
    expect(() =>
      parseAuddResponse({
        status: "error",
        error: { error_code: 901, error_message: "no api_token" },
      })
    ).toThrow(/901/);
  });
});
