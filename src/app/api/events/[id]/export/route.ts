import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { keyFrom, requireHost } from "@/lib/auth";
import {
  SPOTIFY_COOKIE,
  type SpotifyTokens,
  ensureFresh,
  matchTrack,
  createPlaylist,
  addTracks,
} from "@/lib/spotify";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await requireHost(id, keyFrom(req));
  if (!event) return NextResponse.json({ error: "Invalid host key" }, { status: 401 });

  const store = await cookies();
  const raw = store.get(SPOTIFY_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: "Connect Spotify first" }, { status: 401 });
  }

  let tokens: SpotifyTokens;
  try {
    tokens = await ensureFresh(JSON.parse(raw) as SpotifyTokens);
  } catch {
    return NextResponse.json({ error: "Spotify session expired — reconnect" }, { status: 401 });
  }
  store.set(SPOTIFY_COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  const tracks = await prisma.track.findMany({
    where: { eventId: event.id, hidden: false },
    orderBy: { recognizedAt: "asc" },
  });
  if (tracks.length === 0) {
    return NextResponse.json({ error: "No tracks to export yet" }, { status: 400 });
  }

  const uris: string[] = [];
  const unmatched: { id: string; title: string; artist: string }[] = [];
  try {
    for (const t of tracks) {
      const hit = await matchTrack(tokens.accessToken, t);
      if (hit) uris.push(hit.uri);
      else unmatched.push({ id: t.id, title: t.title, artist: t.artist });
    }

    const date = new Date(event.startsAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const playlist = await createPlaylist(
      tokens.accessToken,
      `${event.title} — ${date}`,
      "Recognized live with Vinyl Night"
    );
    if (uris.length > 0) await addTracks(tokens.accessToken, playlist.id, uris);

    await prisma.event.update({
      where: { id: event.id },
      data: { playlistUrl: playlist.url },
    });

    return NextResponse.json({ playlistUrl: playlist.url, added: uris.length, unmatched });
  } catch (err) {
    return NextResponse.json({ error: `Export failed: ${String(err)}` }, { status: 502 });
  }
}
