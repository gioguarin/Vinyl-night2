"use client";

import Link from "next/link";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";

interface Created {
  publicUrl: string;
  hostUrl: string;
  event: { slug: string };
}

export default function HostCreate() {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt: startsAt ? new Date(startsAt).toISOString() : "",
          venue,
          description,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create the event");
      setCreated(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted";

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link href="/" className="font-mono text-xs text-muted hover:text-amber">
        ← Vinyl Night
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Host a night</h1>
      <p className="mt-2 text-sm text-muted">
        One link for the room: details before, the live set log during, the playlist after.
      </p>

      {created ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">
            You&apos;re on the calendar
          </p>
          <p className="mt-3 text-sm">
            <span className="text-muted">Share this with the room:</span>
            <br />
            <span className="font-mono text-sm">{origin + created.publicUrl}</span>
          </p>
          <div className="mt-2">
            <CopyButton text={origin + created.publicUrl} label="Copy public link" />
          </div>
          <p className="mt-5 text-sm">
            <span className="text-labelred">
              Save this host link — it&apos;s your only key to the console:
            </span>
            <br />
            <span className="break-all font-mono text-sm">{origin + created.hostUrl}</span>
          </p>
          <div className="mt-2 flex gap-2">
            <CopyButton text={origin + created.hostUrl} label="Copy host link" />
            <Link
              href={created.hostUrl}
              className="rounded-lg bg-amber px-3 py-1.5 text-sm font-medium text-[color:var(--bg)]"
            >
              Open host console →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-3">
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Basement Vinyl Night Vol. 4"
          />
          <input
            type="datetime-local"
            className={input}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <input
            className={input}
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue (optional)"
          />
          <textarea
            className={input}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the night about? (optional)"
          />
          {error && <p className="text-sm text-labelred">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || !title.trim() || !startsAt}
            className="justify-self-start rounded-lg bg-amber px-4 py-2 text-sm font-medium text-[color:var(--bg)] disabled:opacity-50"
          >
            Create the night
          </button>
        </div>
      )}
    </main>
  );
}
