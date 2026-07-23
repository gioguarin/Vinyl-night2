"use client";

import { useEffect, useRef, useState } from "react";
import NowPlayingCard, { type TrackView } from "./NowPlayingCard";
import TrackList from "./TrackList";

interface StreamTrack extends TrackView {
  hidden?: boolean;
  recognizedAt: string;
}

type StreamMessage =
  | { type: "hello"; event: { status: string }; tracks: StreamTrack[] }
  | { type: "track"; track: StreamTrack }
  | { type: "track_update"; track: StreamTrack }
  | { type: "event"; event: { status: string } };

const byNewest = (a: StreamTrack, b: StreamTrack) =>
  new Date(b.recognizedAt).getTime() - new Date(a.recognizedAt).getTime();

export default function LiveFeed({
  eventId,
  variant = "page",
}: {
  eventId: string;
  variant?: "page" | "projector";
}) {
  const [tracks, setTracks] = useState<StreamTrack[]>([]); // newest first
  const [status, setStatus] = useState<string>("live");
  const [mode, setMode] = useState<"connecting" | "live" | "polling">("connecting");
  const errors = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let closed = false;
    const es = new EventSource(`/api/events/${eventId}/stream`);

    const startPolling = () => {
      if (pollTimer.current) return;
      setMode("polling");
      const poll = async () => {
        try {
          const res = await fetch(`/api/events/${eventId}/tracks`);
          if (!res.ok) return;
          const json = (await res.json()) as { tracks: StreamTrack[] };
          setTracks([...json.tracks].sort(byNewest));
        } catch {
          /* try again next tick */
        }
      };
      poll();
      pollTimer.current = setInterval(poll, 20_000);
    };

    es.onopen = () => {
      errors.current = 0;
      setMode("live");
    };

    es.onmessage = (e) => {
      let msg: StreamMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "hello") {
        setStatus(msg.event.status);
        setTracks([...msg.tracks].sort(byNewest));
      } else if (msg.type === "track") {
        setTracks((prev) => [msg.track, ...prev.filter((t) => t.id !== msg.track.id)]);
      } else if (msg.type === "track_update") {
        setTracks((prev) => {
          const rest = prev.filter((t) => t.id !== msg.track.id);
          return msg.track.hidden ? rest : [msg.track, ...rest].sort(byNewest);
        });
      } else if (msg.type === "event") {
        setStatus(msg.event.status);
      }
    };

    es.onerror = () => {
      errors.current += 1;
      if (errors.current >= 3 && !closed) {
        es.close();
        startPolling();
      }
    };

    return () => {
      closed = true;
      es.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [eventId]);

  const [nowPlaying, ...history] = tracks;

  if (variant === "projector") {
    return (
      <div className="flex min-h-[80vh] flex-col justify-center gap-10">
        <NowPlayingCard track={nowPlaying ?? null} size="projector" />
        {history.length > 0 && (
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
              Earlier tonight
            </p>
            <TrackList tracks={history.slice(0, 5)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {status === "live" ? (
          <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-labelred">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-labelred" /> Live
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
            {status}
          </span>
        )}
        {mode === "polling" && (
          <span className="font-mono text-[10px] text-muted">refreshing every 20s</span>
        )}
      </div>
      <NowPlayingCard track={nowPlaying ?? null} />
      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
          Set log · {tracks.length} {tracks.length === 1 ? "record" : "records"}
        </p>
        <TrackList tracks={history} emptyText="History appears as more records drop." />
      </div>
    </div>
  );
}
