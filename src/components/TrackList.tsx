import type { TrackView } from "./NowPlayingCard";

function timeOf(t: string | Date) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Set log: mono timestamps carry real information (when each record dropped). */
export default function TrackList({
  tracks,
  emptyText = "Nothing recognized yet.",
}: {
  tracks: TrackView[];
  emptyText?: string;
}) {
  if (tracks.length === 0) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }
  return (
    <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {tracks.map((t, i) => (
        <li key={t.id} className="flex items-baseline gap-4 px-4 py-3">
          <span className="font-mono text-xs text-muted w-8 shrink-0">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{t.title}</span>
            <span className="text-muted"> — {t.artist}</span>
          </span>
          <span className="font-mono text-xs text-muted shrink-0">{timeOf(t.recognizedAt)}</span>
        </li>
      ))}
    </ol>
  );
}
