import { prisma } from "./db";

/** Resolve an event by id OR slug. */
export async function findEvent(idOrSlug: string) {
  return prisma.event.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
}

/** Extract the host key from a request (header first, then query string). */
export function keyFrom(req: Request): string | null {
  const header = req.headers.get("x-host-key");
  if (header) return header;
  try {
    return new URL(req.url).searchParams.get("key");
  } catch {
    return null;
  }
}

/** Return the event only if the supplied key matches its hostKey. */
export async function requireHost(idOrSlug: string, key: string | null) {
  if (!key) return null;
  const event = await findEvent(idOrSlug);
  if (!event || event.hostKey !== key) return null;
  return event;
}

/** Public shape of an event — never leaks hostKey. */
export function publicEvent(e: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  coverImage: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  playlistUrl: string | null;
}) {
  const { id, slug, title, description, venue, coverImage, startsAt, endsAt, status, playlistUrl } = e;
  return { id, slug, title, description, venue, coverImage, startsAt, endsAt, status, playlistUrl };
}
