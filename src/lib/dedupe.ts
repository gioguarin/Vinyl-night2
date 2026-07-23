import { trackKey } from "./normalize";

export interface MatchLike {
  title: string;
  artist: string;
  confidence?: number | null;
}

export interface LastTrackLike {
  title: string;
  artist: string;
  recognizedAt: Date;
}

export function confidenceThreshold(): number {
  const v = parseFloat(process.env.CONFIDENCE_THRESHOLD ?? "0.6");
  return Number.isFinite(v) ? v : 0.6;
}

export function dedupeWindowMs(): number {
  const m = parseFloat(process.env.DEDUPE_WINDOW_MIN ?? "8");
  return (Number.isFinite(m) ? m : 8) * 60_000;
}

/**
 * PLAN.md §4 step 4: skip when confidence is below threshold, or when the match
 * is the same normalized title+artist as the most recent visible track within the window.
 */
export function shouldSkip(
  match: MatchLike,
  last: LastTrackLike | null,
  now: Date = new Date()
): { skip: boolean; reason?: "low_confidence" | "duplicate" } {
  if (match.confidence != null && match.confidence < confidenceThreshold()) {
    return { skip: true, reason: "low_confidence" };
  }
  if (
    last &&
    trackKey(match.title, match.artist) === trackKey(last.title, last.artist) &&
    now.getTime() - last.recognizedAt.getTime() < dedupeWindowMs()
  ) {
    return { skip: true, reason: "duplicate" };
  }
  return { skip: false };
}
