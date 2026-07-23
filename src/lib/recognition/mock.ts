import type { Match, RecognitionProvider } from "./types";

/**
 * Mock provider for local testing: cycles through a crate of classics so the
 * whole capture → dedupe → live feed → export loop can be exercised with zero
 * API credits. Every 4th sample returns null to simulate a no-match gap
 * (needle drop, crowd noise, talk break).
 */
const CRATE: Omit<Match, "provider">[] = [
  { title: "Move On Up", artist: "Curtis Mayfield", album: "Curtis", confidence: 0.94 },
  { title: "I Want You", artist: "Marvin Gaye", album: "I Want You", confidence: 0.91 },
  { title: "Strings of Life", artist: "Rhythim Is Rhythim", album: "Strings of Life", confidence: 0.88 },
  { title: "Sueño Latino", artist: "Sueño Latino", album: "Sueño Latino", confidence: 0.9 },
  { title: "Cold Blooded", artist: "James Brown", album: "The Payback", confidence: 0.93 },
  { title: "Galaxy", artist: "War", album: "Galaxy", confidence: 0.89 },
];

const g = globalThis as unknown as { __vn_mock_i?: number };

export const mockProvider: RecognitionProvider = {
  name: "mock",
  async recognize(): Promise<Match | null> {
    const i = (g.__vn_mock_i = (g.__vn_mock_i ?? 0) + 1);
    if (i % 4 === 0) return null; // simulated gap
    const pick = CRATE[Math.floor((i - 1) / 1) % CRATE.length];
    return { ...pick, provider: "mock" };
  },
};
