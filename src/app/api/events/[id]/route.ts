import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findEvent, keyFrom, requireHost, publicEvent } from "@/lib/auth";
import { bus, channel } from "@/lib/bus";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await findEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const [artists, rsvpCount] = await Promise.all([
    prisma.artist.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } }),
    prisma.rsvp.count({ where: { eventId: event.id } }),
  ]);

  return NextResponse.json({ event: publicEvent(event), artists, rsvpCount });
}

const STATUSES = new Set(["upcoming", "live", "ended"]);

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await requireHost(id, keyFrom(req));
  if (!event) return NextResponse.json({ error: "Invalid host key" }, { status: 401 });

  let body: {
    title?: string;
    description?: string | null;
    venue?: string | null;
    startsAt?: string;
    endsAt?: string | null;
    status?: string;
    coverImage?: string | null;
    artists?: { name: string; bio?: string | null; url?: string | null }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status && !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "status must be upcoming | live | ended" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title?.trim()) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.venue !== undefined) data.venue = body.venue?.trim() || null;
  if (body.coverImage !== undefined) data.coverImage = body.coverImage || null;
  if (body.startsAt) {
    const d = new Date(body.startsAt);
    if (!isNaN(d.getTime())) data.startsAt = d;
  }
  if (body.endsAt !== undefined) {
    data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  }
  if (body.status) data.status = body.status;

  const updated = await prisma.$transaction(async (tx) => {
    if (body.artists) {
      await tx.artist.deleteMany({ where: { eventId: event.id } });
      for (const [i, a] of body.artists.entries()) {
        if (!a.name?.trim()) continue;
        await tx.artist.create({
          data: {
            eventId: event.id,
            name: a.name.trim(),
            bio: a.bio?.trim() || null,
            links: a.url?.trim() ? JSON.stringify({ url: a.url.trim() }) : null,
            order: i,
          },
        });
      }
    }
    return tx.event.update({ where: { id: event.id }, data });
  });

  bus.emit(channel(event.id), { type: "event", event: publicEvent(updated) });
  return NextResponse.json({ event: publicEvent(updated) });
}
