import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findEvent } from "@/lib/auth";
import { getProvider } from "@/lib/recognition";
import { shouldSkip } from "@/lib/dedupe";
import { bus, channel } from "@/lib/bus";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 3_500_000; // ~3.5MB — a 12s opus clip is far below this

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await findEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const key = req.headers.get("x-host-key") ?? String(form.get("hostKey") ?? "");
  if (key !== event.hostKey) {
    return NextResponse.json({ error: "Invalid host key" }, { status: 401 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio clip too large" }, { status: 413 });
  }

  const provider = getProvider();
  const buffer = Buffer.from(await audio.arrayBuffer());

  let match;
  try {
    match = await provider.recognize(buffer, audio.type);
  } catch (err) {
    await prisma.recognitionSample.create({
      data: {
        eventId: event.id,
        matched: false,
        raw: JSON.stringify({ error: String(err), provider: provider.name }),
      },
    });
    return NextResponse.json({ error: `Recognition failed: ${String(err)}` }, { status: 502 });
  }

  await prisma.recognitionSample.create({
    data: {
      eventId: event.id,
      matched: !!match,
      raw: match ? JSON.stringify(match) : null,
    },
  });

  if (!match) return NextResponse.json({ matched: false });

  const last = await prisma.track.findFirst({
    where: { eventId: event.id, hidden: false },
    orderBy: { recognizedAt: "desc" },
  });

  const verdict = shouldSkip(match, last);
  if (verdict.skip) {
    return NextResponse.json({ matched: true, skipped: true, reason: verdict.reason, match });
  }

  const track = await prisma.track.create({
    data: {
      eventId: event.id,
      title: match.title,
      artist: match.artist,
      album: match.album ?? null,
      artworkUrl: match.artworkUrl ?? null,
      isrc: match.isrc ?? null,
      spotifyId: match.spotifyId ?? null,
      provider: match.provider,
      confidence: match.confidence ?? null,
    },
  });

  bus.emit(channel(event.id), { type: "track", track });
  return NextResponse.json({ matched: true, skipped: false, track }, { status: 201 });
}
