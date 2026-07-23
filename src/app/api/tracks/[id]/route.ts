import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { keyFrom } from "@/lib/auth";
import { bus, channel } from "@/lib/bus";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const track = await prisma.track.findUnique({ where: { id }, include: { event: true } });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  if (keyFrom(req) !== track.event.hostKey) {
    return NextResponse.json({ error: "Invalid host key" }, { status: 401 });
  }

  let body: { hidden?: boolean; title?: string; artist?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.hidden === "boolean") data.hidden = body.hidden;
  if (body.title?.trim()) data.title = body.title.trim();
  if (body.artist?.trim()) data.artist = body.artist.trim();

  const updated = await prisma.track.update({ where: { id }, data });
  bus.emit(channel(track.eventId), { type: "track_update", track: updated });
  return NextResponse.json({ track: updated });
}
