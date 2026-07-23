"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";

interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  status: string;
  playlistUrl: string | null;
}
interface ArtistRow {
  name: string;
  bio: string;
  url: string;
}
interface TrackRow {
  id: string;
  title: string;
  artist: string;
  hidden: boolean;
  spotifyId: string | null;
  recognizedAt: string;
  provider: string;
}
interface ExportResult {
  playlistUrl: string;
  added: number;
  unmatched: { id: string; title: string; artist: string }[];
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HostConsole({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [key, setKey] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [rsvpCount, setRsvpCount] = useState(0);

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [artists, setArtists] = useState<ArtistRow[]>([]);

  const [notice, setNotice] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Key comes from ?key= on first visit, then localStorage.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    const stored = localStorage.getItem(`vn_key_${slug}`);
    const k = fromUrl ?? stored;
    if (fromUrl) localStorage.setItem(`vn_key_${slug}`, fromUrl);
    setKey(k);
    const sp = new URLSearchParams(window.location.search).get("spotify");
    if (sp === "connected") setNotice("Spotify connected — you can export when the night ends.");
    if (sp === "denied") setNotice("Spotify connection was cancelled.");
    if (sp === "error") setNotice("Spotify connection failed — check your app credentials.");
  }, [slug]);

  const loadTracks = useCallback(
    async (k: string) => {
      const res = await fetch(`/api/events/${slug}/tracks?all=1`, {
        headers: { "x-host-key": k },
      });
      if (res.ok) {
        const json = await res.json();
        setTracks(json.tracks);
      }
    },
    [slug]
  );

  useEffect(() => {
    if (!key) return;
    (async () => {
      const res = await fetch(`/api/events/${slug}`);
      if (!res.ok) return;
      const json = await res.json();
      setEvent(json.event);
      setRsvpCount(json.rsvpCount);
      setTitle(json.event.title);
      setVenue(json.event.venue ?? "");
      setDescription(json.event.description ?? "");
      setStartsAt(toLocalInput(json.event.startsAt));
      setArtists(
        (json.artists as { name: string; bio: string | null; links: string | null }[]).map(
          (a) => {
            let url = "";
            try {
              url = a.links ? (JSON.parse(a.links).url ?? "") : "";
            } catch {
              url = "";
            }
            return { name: a.name, bio: a.bio ?? "", url };
          }
        )
      );
      loadTracks(key);
    })();
  }, [key, slug, loadTracks]);

  const patch = async (body: Record<string, unknown>, message: string) => {
    if (!key || !event) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-host-key": key },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setEvent(json.event);
      setNotice(message);
    } catch (err) {
      setNotice(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = () =>
    patch(
      {
        title,
        venue,
        description,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        artists,
      },
      "Details saved."
    );

  const setStatus = (status: string) =>
    patch({ status }, status === "live" ? "You're live." : `Status set to ${status}.`);

  const toggleTrack = async (t: TrackRow) => {
    if (!key) return;
    await fetch(`/api/tracks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-host-key": key },
      body: JSON.stringify({ hidden: !t.hidden }),
    });
    loadTracks(key);
  };

  const runExport = async () => {
    if (!key || !event) return;
    setBusy(true);
    setNotice(null);
    setExportResult(null);
    try {
      const res = await fetch(`/api/events/${event.id}/export`, {
        method: "POST",
        headers: { "x-host-key": key },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      setExportResult(json);
      setEvent((e) => (e ? { ...e, playlistUrl: json.playlistUrl } : e));
    } catch (err) {
      setNotice(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  if (key === null) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          This console needs your host key. Open the host link you saved when creating the event
          (it looks like <span className="font-mono">/host/e/{slug}?key=…</span>).
        </p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-mono text-sm text-muted">Loading console…</p>
      </main>
    );
  }

  const input =
    "w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted";
  const btn =
    "rounded-lg border border-line bg-surface2 px-3 py-1.5 text-sm hover:border-amber disabled:opacity-50";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="font-mono text-xs text-muted hover:text-amber">
        ← Vinyl Night
      </Link>
      <header className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-amber">
          Host console
        </span>
      </header>
      <p className="mt-1 font-mono text-xs text-muted">
        {rsvpCount} on the list · status: {event.status}
      </p>

      {notice && (
        <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-amber">
          {notice}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">Tonight</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={btn}
            disabled={busy || event.status === "live"}
            onClick={() => setStatus("live")}
          >
            Go live
          </button>
          <button
            className={btn}
            disabled={busy || event.status === "ended"}
            onClick={() => setStatus("ended")}
          >
            End the night
          </button>
          <button
            className={btn}
            disabled={busy || event.status === "upcoming"}
            onClick={() => setStatus("upcoming")}
          >
            Back to upcoming
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link className={btn} href={`/host/e/${slug}/listen?key=${key}`}>
            Open the listener →
          </Link>
          <Link className={btn} href={`/e/${slug}`} target="_blank">
            Public page ↗
          </Link>
          <Link className={btn} href={`/e/${slug}/live`} target="_blank">
            Projector ↗
          </Link>
          <CopyButton
            text={typeof window !== "undefined" ? `${window.location.origin}/e/${slug}` : ""}
            label="Copy public link"
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">Details</p>
        <div className="mt-3 grid gap-3">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <input className={input} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" />
          <input
            type="datetime-local"
            className={input}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <textarea
            className={input}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the night about?"
          />
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">Lineup</p>
        <div className="mt-2 grid gap-2">
          {artists.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={input}
                value={a.name}
                placeholder="Name"
                onChange={(e) =>
                  setArtists(artists.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <input
                className={input}
                value={a.url}
                placeholder="Link (optional)"
                onChange={(e) =>
                  setArtists(artists.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                }
              />
              <button className={btn} onClick={() => setArtists(artists.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button
            className={`${btn} justify-self-start`}
            onClick={() => setArtists([...artists, { name: "", bio: "", url: "" }])}
          >
            + Add artist
          </button>
        </div>
        <button
          onClick={saveDetails}
          disabled={busy}
          className="mt-4 rounded-lg bg-amber px-4 py-2 text-sm font-medium text-[color:var(--bg)] disabled:opacity-50"
        >
          Save changes
        </button>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
            Set log · {tracks.length}
          </p>
          <button className={btn} onClick={() => key && loadTracks(key)}>
            Refresh
          </button>
        </div>
        {tracks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing yet — open the listener once you&apos;re live.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {tracks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className={`min-w-0 flex-1 text-sm ${t.hidden ? "text-muted line-through" : ""}`}>
                  {t.title} <span className="text-muted">— {t.artist}</span>
                </span>
                <span className="font-mono text-[10px] text-muted">{t.provider}</span>
                <button className={btn} onClick={() => toggleTrack(t)}>
                  {t.hidden ? "Unhide" : "Hide"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">Playlist</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className={btn} href={`/api/spotify/auth?slug=${slug}&key=${key}`}>
            Connect Spotify
          </a>
          <button className={btn} disabled={busy || tracks.length === 0} onClick={runExport}>
            Export playlist
          </button>
          {event.playlistUrl && (
            <a
              className="rounded-lg bg-amber px-3 py-1.5 text-sm font-medium text-[color:var(--bg)]"
              href={event.playlistUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open playlist ↗
            </a>
          )}
        </div>
        {exportResult && (
          <div className="mt-3 text-sm">
            <p className="text-amber">Added {exportResult.added} tracks.</p>
            {exportResult.unmatched.length > 0 && (
              <div className="mt-2">
                <p className="text-muted">Couldn&apos;t match on Spotify:</p>
                <ul className="mt-1 list-inside list-disc text-muted">
                  {exportResult.unmatched.map((u) => (
                    <li key={u.id}>
                      {u.title} — {u.artist}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
