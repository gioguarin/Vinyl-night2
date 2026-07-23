const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";
export const SPOTIFY_COOKIE = "vn_spotify";

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

function clientCreds() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify env vars are not set");
  return { id, secret, basic: Buffer.from(`${id}:${secret}`).toString("base64") };
}

export function getAuthUrl(state: string): string {
  const { id } = clientCreds();
  const redirect = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirect) throw new Error("SPOTIFY_REDIRECT_URI is not set");
  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirect,
    scope: "playlist-modify-public playlist-modify-private",
    state,
  });
  return `${ACCOUNTS}/authorize?${params}`;
}

async function tokenRequest(body: URLSearchParams): Promise<SpotifyTokens> {
  const { basic } = clientCreds();
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token HTTP ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function exchangeCode(code: string): Promise<SpotifyTokens> {
  const redirect = process.env.SPOTIFY_REDIRECT_URI ?? "";
  return tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect })
  );
}

export async function ensureFresh(tokens: SpotifyTokens): Promise<SpotifyTokens> {
  if (tokens.expiresAt - Date.now() > 60_000) return tokens;
  const fresh = await tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refreshToken })
  );
  return { ...fresh, refreshToken: fresh.refreshToken || tokens.refreshToken };
}

async function api<T>(access: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 429) {
    const wait = (parseInt(res.headers.get("Retry-After") ?? "1", 10) + 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return api<T>(access, path, init);
  }
  if (!res.ok) throw new Error(`Spotify HTTP ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/** Exported for unit tests. */
export function buildSearchQuery(t: { isrc?: string | null; title: string; artist: string }): string {
  if (t.isrc) return `isrc:${t.isrc}`;
  return `track:${t.title} artist:${t.artist}`;
}

/** Exported for unit tests. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface SearchResponse {
  tracks?: { items?: { id: string; uri: string }[] };
}

/**
 * PLAN.md §4 matching chain: known spotifyId → ISRC search → title/artist search → null.
 * Never guesses silently: callers surface nulls as "unmatched".
 */
export async function matchTrack(
  access: string,
  t: { spotifyId?: string | null; isrc?: string | null; title: string; artist: string }
): Promise<{ uri: string; via: "id" | "isrc" | "search" } | null> {
  if (t.spotifyId) return { uri: `spotify:track:${t.spotifyId}`, via: "id" };
  if (t.isrc) {
    const r = await api<SearchResponse>(
      access,
      `/search?type=track&limit=1&q=${encodeURIComponent(buildSearchQuery({ isrc: t.isrc, title: t.title, artist: t.artist }))}`
    );
    const hit = r.tracks?.items?.[0];
    if (hit) return { uri: hit.uri, via: "isrc" };
  }
  const r = await api<SearchResponse>(
    access,
    `/search?type=track&limit=1&q=${encodeURIComponent(buildSearchQuery({ title: t.title, artist: t.artist }))}`
  );
  const hit = r.tracks?.items?.[0];
  return hit ? { uri: hit.uri, via: "search" } : null;
}

export async function createPlaylist(
  access: string,
  name: string,
  description: string
): Promise<{ id: string; url: string }> {
  const me = await api<{ id: string }>(access, "/me");
  const pl = await api<{ id: string; external_urls?: { spotify?: string } }>(
    access,
    `/users/${encodeURIComponent(me.id)}/playlists`,
    { method: "POST", body: JSON.stringify({ name, description, public: false }) }
  );
  return { id: pl.id, url: pl.external_urls?.spotify ?? `https://open.spotify.com/playlist/${pl.id}` };
}

export async function addTracks(access: string, playlistId: string, uris: string[]): Promise<void> {
  for (const batch of chunk(uris, 100)) {
    await api(access, `/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }
}
