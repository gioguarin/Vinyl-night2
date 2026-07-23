import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findEvent } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await findEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = body.name?.trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  await prisma.rsvp.create({ data: { eventId: event.id, name } });
  const count = await prisma.rsvp.count({ where: { eventId: event.id } });
  return NextResponse.json({ ok: true, count }, { status: 201 });
}
