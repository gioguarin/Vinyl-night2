import Link from "next/link";
import Vinyl from "@/components/Vinyl";
import { demoEvents, demoRepoUrl, demoTimeZone } from "@/lib/demo-fixtures";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: demoTimeZone,
  });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: demoTimeZone,
  });
}

export default function Home() {
  const upcoming = demoEvents.filter((e) => e.status === "upcoming");
  const past = demoEvents.filter((e) => e.status === "ended");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="flex items-center gap-8">
        <Vinyl size={112} label="33 1/3" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">
            Listening parties, logged live
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">Vinyl Night</h1>
          <p className="mt-3 max-w-md text-muted">
            Drop the needle. A phone by the speaker recognizes each record as it plays, the room
            watches the set log fill in, and the night ends as a playlist.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href={demoRepoUrl}
              className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-[color:var(--bg)]"
            >
              Run it yourself ↗
            </a>
          </div>
        </div>
      </header>

      <section className="mt-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">
          Upcoming nights
        </p>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
            Nothing on the calendar yet. Host one and share the link.
          </p>
        ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {upcoming.map((e) => (
            <li key={e.slug}>
              <Link
                href={`/e/${e.slug}`}
                className="flex items-baseline gap-4 px-5 py-4 hover:bg-surface2"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-muted">
                  {fmtDate(new Date(e.startsAt))}
                  <br />
                  {fmtTime(new Date(e.startsAt))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{e.title}</span>
                  {e.venue && <span className="text-muted"> · {e.venue}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        )}
      </section>

      <section className="mt-12">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">
          Last time
        </p>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {past.map((e) => (
            <li key={e.slug}>
              <Link
                href={`/e/${e.slug}`}
                className="flex items-baseline gap-4 px-5 py-4 hover:bg-surface2"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-muted">
                  {fmtDate(new Date(e.startsAt))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{e.title}</span>
                  {e.venue && <span className="text-muted"> · {e.venue}</span>}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {e.tracks.length} records →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
