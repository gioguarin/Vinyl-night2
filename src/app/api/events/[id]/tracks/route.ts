import { NextResponse } from "next/server";
import { findEvent, keyFrom } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await findEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const wantAll = new URL(req.url).searchParams.get("all") === "1";
  const isHost = wantAll && keyFrom(req) === event.hostKey;
  if (wantAll && !isHost) {
    return NextResponse.json({ error: "Invalid host key" }, { status: 401 });
  }

  const tracks = await prisma.track.findMany({
    where: { eventId: event.id, ...(isHost ? {} : { hidden: false }) },
    orderBy: { recognizedAt: "asc" },
  });
  return NextResponse.json({ tracks });
}
