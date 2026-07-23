import { createHmac } from "crypto";
import type { Match, RecognitionProvider } from "./types";

interface AcrMusic {
  title?: string;
  artists?: { name?: string }[];
  album?: { name?: string };
  score?: number;
  external_ids?: { isrc?: string };
  external_metadata?: { spotify?: { track?: { id?: string } } };
}

/** Exported for unit tests. */
export function parseAcrResponse(json: unknown): Match | null {
  const res = json as {
    status?: { code?: number; msg?: string };
    metadata?: { music?: AcrMusic[] };
  };
  const code = res?.status?.code;
  if (code === 1001) return null; // no result
  if (code !== 0) throw new Error(`ACRCloud error ${code}: ${res?.status?.msg ?? "unknown"}`);
  const m = res?.metadata?.music?.[0];
  if (!m?.title) return null;
  return {
    title: m.title,
    artist: m.artists?.map((a) => a.name).filter(Boolean).join(", ") || "Unknown",
    album: m.album?.name ?? null,
    isrc: m.external_ids?.isrc ?? null,
    spotifyId: m.external_metadata?.spotify?.track?.id ?? null,
    artworkUrl: null,
    confidence: typeof m.score === "number" ? m.score / 100 : null,
    provider: "acrcloud",
  };
}

export const acrCloudProvider: RecognitionProvider = {
  name: "acrcloud",
  async recognize(audio: Buffer): Promise<Match | null> {
    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secret = process.env.ACRCLOUD_ACCESS_SECRET;
    if (!host || !accessKey || !secret) throw new Error("ACRCloud env vars are not set");

    const method = "POST";
    const uri = "/v1/identify";
    const dataType = "audio";
    const signatureVersion = "1";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = [method, uri, accessKey, dataType, signatureVersion, timestamp].join("\n");
    const signature = createHmac("sha1", secret).update(stringToSign).digest("base64");

    const form = new FormData();
    form.append("access_key", accessKey);
    form.append("data_type", dataType);
    form.append("signature_version", signatureVersion);
    form.append("signature", signature);
    form.append("timestamp", timestamp);
    form.append("sample_bytes", String(audio.length));
    form.append("sample", new Blob([new Uint8Array(audio)]), "sample.webm");

    const res = await fetch(`https://${host}${uri}`, { method, body: form });
    if (!res.ok) throw new Error(`ACRCloud HTTP ${res.status}`);
    return parseAcrResponse(await res.json());
  },
};
