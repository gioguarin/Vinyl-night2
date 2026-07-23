import Link from "next/link";
import { prisma } from "@/lib/db";
import Vinyl from "@/components/Vinyl";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function Home() {
  const events = await prisma.event.findMany({
    where: { status: { in: ["upcoming", "live"] } },
    orderBy: { startsAt: "asc" },
    take: 12,
  });

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
            <Link
              href="/host"
              className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-[color:var(--bg)]"
            >
              Host a night
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">
          Upcoming nights
        </p>
        {events.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
            Nothing on the calendar yet. Host one and share the link.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/e/${e.slug}`}
                  className="flex items-baseline gap-4 px-5 py-4 hover:bg-surface2"
                >
                  <span className="w-24 shrink-0 font-mono text-xs text-muted">
                    {fmtDate(e.startsAt)}
                    <br />
                    {fmtTime(e.startsAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{e.title}</span>
                    {e.venue && <span className="text-muted"> · {e.venue}</span>}
                  </span>
                  {e.status === "live" && (
                    <span className="flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-widest text-labelred">
                      <span className="live-dot h-2 w-2 rounded-full bg-labelred" />
                      Live
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
