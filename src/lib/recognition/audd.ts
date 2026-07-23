import type { Match, RecognitionProvider } from "./types";

interface AuddSpotify {
  id?: string;
  album?: { images?: { url?: string }[] };
}
interface AuddAppleMusic {
  artwork?: { url?: string };
}
interface AuddResult {
  title?: string;
  artist?: string;
  album?: string;
  isrc?: string;
  spotify?: AuddSpotify;
  apple_music?: AuddAppleMusic;
}
interface AuddResponse {
  status?: string;
  error?: { error_code?: number; error_message?: string };
  result?: AuddResult | null;
}

/** Exported for unit tests. Throws on an API-level error; returns null on no match. */
export function parseAuddResponse(json: unknown): Match | null {
  const res = json as AuddResponse;
  if (res?.status === "error") {
    throw new Error(
      `AudD error ${res.error?.error_code ?? "?"}: ${res.error?.error_message ?? "unknown"}`
    );
  }
  const r = res?.result;
  if (!r || !r.title || !r.artist) return null;

  let artworkUrl: string | null = r.spotify?.album?.images?.[0]?.url ?? null;
  if (!artworkUrl && r.apple_music?.artwork?.url) {
    artworkUrl = r.apple_music.artwork.url.replace("{w}", "500").replace("{h}", "500");
  }

  return {
    title: r.title,
    artist: r.artist,
    album: r.album ?? null,
    isrc: r.isrc ?? null,
    spotifyId: r.spotify?.id ?? null,
    artworkUrl,
    confidence: null, // AudD is binary: a result either exists or it doesn't
    provider: "audd",
  };
}

export const auddProvider: RecognitionProvider = {
  name: "audd",
  async recognize(audio: Buffer, mime: string): Promise<Match | null> {
    const token = process.env.AUDD_API_TOKEN;
    if (!token) throw new Error("AUDD_API_TOKEN is not set");

    const form = new FormData();
    form.append("api_token", token);
    form.append("return", "spotify,apple_music");
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type: mime || "audio/webm" }),
      "sample.webm"
    );

    const res = await fetch("https://api.audd.io/", { method: "POST", body: form });
    if (!res.ok) throw new Error(`AudD HTTP ${res.status}`);
    return parseAuddResponse(await res.json());
  },
};
