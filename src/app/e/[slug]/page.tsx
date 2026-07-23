import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import LiveFeed from "@/components/LiveFeed";
import RsvpForm from "@/components/RsvpForm";
import TrackList from "@/components/TrackList";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  return { title: event ? `${event.title} · Vinyl Night` : "Vinyl Night" };
}

function fmtWhen(d: Date) {
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { artists: { orderBy: { order: "asc" } } },
  });
  if (!event) notFound();

  const rsvpCount = await prisma.rsvp.count({ where: { eventId: event.id } });
  const recapTracks =
    event.status === "ended"
      ? await prisma.track.findMany({
          where: { eventId: event.id, hidden: false },
          orderBy: { recognizedAt: "asc" },
        })
      : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="font-mono text-xs text-muted hover:text-amber">
        ← Vinyl Night
      </Link>

      <header className="mt-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">
          {fmtWhen(event.startsAt)}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{event.title}</h1>
        {event.venue && <p className="mt-2 text-muted">{event.venue}</p>}
        {event.description && (
          <p className="mt-4 max-w-xl whitespace-pre-line text-ink/90">{event.description}</p>
        )}
      </header>

      {event.status === "live" && (
        <section className="mt-10 space-y-3">
          <LiveFeed eventId={event.id} />
          <p className="text-right">
            <Link
              href={`/e/${event.slug}/live`}
              className="font-mono text-xs text-muted hover:text-amber"
            >
              Projector view →
            </Link>
          </p>
        </section>
      )}

      {event.status === "ended" && (
        <section className="mt-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
            The set log · {recapTracks.length} records
          </p>
          {event.playlistUrl && (
            <a
              href={event.playlistUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 inline-block rounded-lg bg-amber px-4 py-2 text-sm font-medium text-[color:var(--bg)]"
            >
              Open the playlist ↗
            </a>
          )}
          <TrackList tracks={recapTracks} emptyText="No records made the log this time." />
        </section>
      )}

      {event.artists.length > 0 && (
        <section className="mt-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
            On the decks
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {event.artists.map((a) => {
              let url: string | null = null;
              try {
                url = a.links ? (JSON.parse(a.links).url ?? null) : null;
              } catch {
                url = null;
              }
              return (
                <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-medium">{a.name}</p>
                  {a.bio && <p className="mt-1 text-sm text-muted">{a.bio}</p>}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-mono text-xs text-amber"
                    >
                      {url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {event.status === "upcoming" && (
        <section className="mt-10">
          <RsvpForm eventId={event.id} initialCount={rsvpCount} />
        </section>
      )}
    </main>
  );
}
