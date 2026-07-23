"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import Vinyl from "@/components/Vinyl";

const SAMPLE_MS = 12_000; // clip length per PLAN.md
const INTERVAL_MS = 60_000; // one sample per minute
const FAIL_LIMIT = 3; // consecutive failures before backing off one cycle

interface LogEntry {
  at: string;
  text: string;
  kind: "match" | "miss" | "skip" | "error" | "info";
}
interface LastMatch {
  title: string;
  artist: string;
}
interface EventInfo {
  id: string;
  title: string;
  status: string;
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
    MediaRecorder.isTypeSupported(m)
  );
}

export default function ListenerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [key, setKey] = useState<string | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [matches, setMatches] = useState(0);
  const [last, setLast] = useState<LastMatch | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const failStreak = useRef(0);
  const skipNext = useRef(false);
  const runningRef = useRef(false);

  const addLog = (text: string, kind: LogEntry["kind"]) => {
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLog((prev) => [{ at, text, kind }, ...prev].slice(0, 60));
  };

  // Host key: URL first, then localStorage (shared with the console).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    const stored = localStorage.getItem(`vn_key_${slug}`);
    if (fromUrl) localStorage.setItem(`vn_key_${slug}`, fromUrl);
    setKey(fromUrl ?? stored);
  }, [slug]);

  useEffect(() => {
    fetch(`/api/events/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => json && setEvent(json.event))
      .catch(() => setFatal("Could not load the event."));
  }, [slug]);

  const acquireWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      addLog("Screen wake lock unavailable — keep the screen on manually.", "info");
    }
  };

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && runningRef.current) acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const meterLoop = () => {
    const analyser = analyserRef.current;
    const el = meterRef.current;
    if (analyser && el) {
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      el.style.width = `${Math.min(100, Math.round(rms * 300))}%`;
    }
    rafRef.current = requestAnimationFrame(meterLoop);
  };

  const upload = async (blob: Blob) => {
    if (!event || !key) return;
    const form = new FormData();
    form.append("audio", blob, "sample.webm");
    form.append("hostKey", key);
    try {
      const res = await fetch(`/api/events/${event.id}/recognize`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      failStreak.current = 0;
      if (!json.matched) {
        addLog("No match — between records, or the room's talking.", "miss");
      } else if (json.skipped) {
        if (json.reason === "duplicate") {
          addLog(`Still spinning: ${json.match.title}`, "skip");
        } else {
          addLog(`Low confidence — skipped ${json.match.title}`, "skip");
        }
      } else {
        setMatches((m) => m + 1);
        setLast({ title: json.track.title, artist: json.track.artist });
        addLog(`${json.track.title} — ${json.track.artist}`, "match");
      }
    } catch (err) {
      failStreak.current += 1;
      addLog(`Upload failed: ${String(err instanceof Error ? err.message : err)}`, "error");
      if (failStreak.current >= FAIL_LIMIT) {
        skipNext.current = true;
        failStreak.current = 0;
        addLog("Backing off — the next cycle will be skipped.", "info");
      }
    }
  };

  const runCycle = () => {
    if (!runningRef.current || !streamRef.current) return;
    if (skipNext.current) {
      skipNext.current = false;
      addLog("Skipped this cycle (backoff).", "info");
      return;
    }
    if (recorderRef.current?.state === "recording") return; // safety: never overlap

    const mime = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    } catch {
      addLog("This browser can't record audio clips.", "error");
      return;
    }
    recorderRef.current = recorder;
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      setRecording(false);
      recorderRef.current = null;
      setSamples((s) => s + 1);
      const blob = new Blob(chunks, { type: mime ?? "audio/webm" });
      if (blob.size > 0) upload(blob);
    };
    recorder.start();
    setRecording(true);
    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, SAMPLE_MS);
  };

  const start = async () => {
    setFatal(null);
    if (!key) {
      setFatal("Missing host key — open this page from the host console.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const Ctx = window.AudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      setFatal("Microphone access denied. Allow the mic and try again.");
      return;
    }
    runningRef.current = true;
    setRunning(true);
    await acquireWakeLock();
    addLog("Listening — sampling 12s of every minute.", "info");
    meterLoop();
    runCycle();
    intervalRef.current = setInterval(runCycle, INTERVAL_MS);
  };

  const stop = () => {
    runningRef.current = false;
    setRunning(false);
    setRecording(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    addLog("Stopped.", "info");
  };

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const kindColor: Record<LogEntry["kind"], string> = {
    match: "text-amber",
    miss: "text-muted",
    skip: "text-muted",
    error: "text-labelred",
    info: "text-ink",
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href={`/host/e/${slug}`} className="font-mono text-xs text-muted hover:text-amber">
        ← Host console
      </Link>
      <header className="mt-4">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">The listener</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {event?.title ?? "Loading…"}
        </h1>
        {event && event.status !== "live" && (
          <p className="mt-2 text-sm text-labelred">
            Heads up: the event isn&apos;t live yet — samples still record, but flip it live from
            the console so the room sees the feed.
          </p>
        )}
      </header>

      <section className="mt-8 flex flex-col items-center gap-6 rounded-2xl border border-line bg-surface p-8">
        <Vinyl size={140} spinning={running} label={running ? "on air" : "paused"} />
        <button
          onClick={running ? stop : start}
          disabled={!event || key === null}
          className={`w-full rounded-xl px-5 py-4 text-lg font-semibold disabled:opacity-50 ${
            running
              ? "border border-line bg-surface2 text-ink"
              : "bg-amber text-[color:var(--bg)]"
          }`}
        >
          {running ? "Stop listening" : "Start listening"}
        </button>

        <div className="w-full">
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
            <span>Mic level</span>
            <span>{recording ? "● recording" : running ? "waiting" : "off"}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface2">
            <div ref={meterRef} className="h-full bg-amber transition-[width]" style={{ width: 0 }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Set the phone near a speaker — the bar should move with the music.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-line bg-surface2 p-3">
            <p className="text-2xl font-semibold">{samples}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Samples</p>
          </div>
          <div className="rounded-xl border border-line bg-surface2 p-3">
            <p className="text-2xl font-semibold">{matches}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Records</p>
          </div>
        </div>

        {last && (
          <p className="w-full text-center text-sm">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Last drop
            </span>
            <br />
            <span className="font-medium">{last.title}</span>
            <span className="text-muted"> — {last.artist}</span>
          </p>
        )}
      </section>

      {fatal && <p className="mt-4 text-sm text-labelred">{fatal}</p>}
      {key === null && (
        <p className="mt-4 text-sm text-labelred">
          Missing host key — open this page from the host console link.
        </p>
      )}

      <section className="mt-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-muted">Log</p>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-line bg-surface p-4 font-mono text-xs">
          {log.length === 0 && <li className="text-muted">Nothing yet.</li>}
          {log.map((l, i) => (
            <li key={i} className={kindColor[l.kind]}>
              <span className="text-muted">{l.at}</span> {l.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
