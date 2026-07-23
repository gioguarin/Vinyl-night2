import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { makeSlug } from "@/lib/slug";
import { publicEvent } from "@/lib/auth";

export async function POST(req: Request) {
  let body: {
    title?: string;
    startsAt?: string;
    endsAt?: string;
    description?: string;
    venue?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!title || !startsAt || isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "title and a valid startsAt are required" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title,
      slug: makeSlug(title),
      startsAt,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      description: body.description?.trim() || null,
      venue: body.venue?.trim() || null,
      hostKey: nanoid(24),
    },
  });

  return NextResponse.json(
    {
      event: publicEvent(event),
      hostKey: event.hostKey,
      hostUrl: `/host/e/${event.slug}?key=${event.hostKey}`,
      publicUrl: `/e/${event.slug}`,
    },
    { status: 201 }
  );
}
