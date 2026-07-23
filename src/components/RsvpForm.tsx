"use client";

import { useState } from "react";

export default function RsvpForm({
  eventId,
  initialCount,
}: {
  eventId: string;
  initialCount: number;
}) {
  const [name, setName] = useState("");
  const [count, setCount] = useState(initialCount);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "RSVP failed");
      setCount(json.count);
      setDone(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">On the list</p>
      <p className="mt-1 text-sm text-muted">
        {count === 0 ? "Be the first name on the list." : `${count} coming so far.`}
      </p>
      {done ? (
        <p className="mt-4 font-medium text-amber">You&apos;re on the list. See you there.</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Your name"
            className="w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted"
          />
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-[color:var(--bg)] disabled:opacity-50"
          >
            Count me in
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-labelred">{error}</p>}
    </div>
  );
}
