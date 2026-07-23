import Link from "next/link";
import { notFound } from "next/navigation";
import TrackList from "@/components/TrackList";
import { demoEvents, getDemoEvent } from "@/lib/demo-fixtures";

export const dynamicParams = false;

export function generateStaticParams() {
  return demoEvents.map((e) => ({ slug: e.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const event = getDemoEvent(slug);
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
  const event = getDemoEvent(slug);
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="font-mono text-xs text-muted hover:text-amber">
        ← Vinyl Night
      </Link>

      <header className="mt-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">
          {fmtWhen(new Date(event.startsAt))}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{event.title}</h1>
        {event.venue && <p className="mt-2 text-muted">{event.venue}</p>}
        {event.description && (
          <p className="mt-4 max-w-xl whitespace-pre-line text-ink/90">{event.description}</p>
        )}
      </header>

      {event.status === "ended" && (
        <section className="mt-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
            The set log · {event.tracks.length} records
          </p>
          <TrackList tracks={event.tracks} emptyText="No records made the log this time." />
        </section>
      )}

      {event.artists.length > 0 && (
        <section className="mt-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
            On the decks
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {event.artists.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                <p className="font-medium">{a.name}</p>
                {a.bio && <p className="mt-1 text-sm text-muted">{a.bio}</p>}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-mono text-xs text-amber"
                  >
                    {a.url.replace(/^https?:\/\//, "")} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {event.status === "upcoming" && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
            {event.rsvpCount} going
          </p>
          <p className="mt-2 text-sm text-muted">
            RSVPs happen in the live app — this page is a static demo.
          </p>
        </section>
      )}
    </main>
  );
}
