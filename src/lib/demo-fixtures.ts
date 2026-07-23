/**
 * Fixture data for the static GitHub Pages demo (scripts/build-demo.sh).
 * The demo build swaps the Prisma-backed pages for variants in demo/app
 * that render these instead — no database, no API routes.
 */

import type { TrackView } from "@/components/NowPlayingCard";

/** The fixtures encode evening times at these venues; the static build must not
 * render them in the CI runner's timezone (UTC would turn 8:30 PM into 1:30 AM). */
export const demoTimeZone = "America/New_York";

export const demoRepoUrl = "https://github.com/gioguarin/Vinyl-night2";

export interface DemoArtist {
  id: string;
  name: string;
  bio?: string;
  url?: string;
}

export interface DemoEvent {
  slug: string;
  title: string;
  description?: string;
  venue?: string;
  startsAt: string;
  status: "upcoming" | "ended";
  rsvpCount: number;
  playlistUrl?: string;
  artists: DemoArtist[];
  tracks: TrackView[];
}

export const demoEvents: DemoEvent[] = [
  {
    slug: "crate-night-vol-2",
    title: "Crate Night Vol. 2",
    description:
      "Bring a record, leave with a playlist. Doors at 8, needle drops at 8:30.\nBYO crate — house rule: nothing you've played before.",
    venue: "The Back Room, Ridgewood",
    startsAt: "2026-12-05T01:30:00Z",
    status: "upcoming",
    rsvpCount: 14,
    artists: [
      {
        id: "a1",
        name: "Gio",
        bio: "Host. Soul 45s and the occasional salsa dura detour.",
        url: "https://www.instagram.com/vinylnight",
      },
      {
        id: "a2",
        name: "Marisol",
        bio: "Deep crates of boogaloo and Fania-era Latin soul.",
      },
    ],
    tracks: [],
  },
  {
    slug: "first-night",
    title: "First Night — Motown & Soul",
    description: "The one that started it. Eight records, one sleeve at a time.",
    venue: "Gio's living room",
    startsAt: "2026-06-21T00:00:00Z",
    status: "ended",
    rsvpCount: 9,
    // Stand-in for the exported playlist: a search never 404s, unlike a fake playlist id.
    playlistUrl: "https://open.spotify.com/search/motown%20soul%20classics",
    artists: [],
    tracks: [
      { id: "t1", title: "I Want You Back", artist: "The Jackson 5", album: "Diana Ross Presents The Jackson 5", recognizedAt: "2026-06-21T00:34:00Z" },
      { id: "t2", title: "Ain't No Sunshine", artist: "Bill Withers", album: "Just As I Am", recognizedAt: "2026-06-21T00:41:00Z" },
      { id: "t3", title: "Move On Up", artist: "Curtis Mayfield", album: "Curtis", recognizedAt: "2026-06-21T00:49:00Z" },
      { id: "t4", title: "Cissy Strut", artist: "The Meters", album: "The Meters", recognizedAt: "2026-06-21T01:02:00Z" },
      { id: "t5", title: "Superstition", artist: "Stevie Wonder", album: "Talking Book", recognizedAt: "2026-06-21T01:11:00Z" },
      { id: "t6", title: "Let's Stay Together", artist: "Al Green", album: "Let's Stay Together", recognizedAt: "2026-06-21T01:20:00Z" },
      { id: "t7", title: "I'll Take You There", artist: "The Staple Singers", album: "Be Altitude: Respect Yourself", recognizedAt: "2026-06-21T01:31:00Z" },
      { id: "t8", title: "Papa Was a Rollin' Stone", artist: "The Temptations", album: "All Directions", recognizedAt: "2026-06-21T01:43:00Z" },
    ],
  },
];

export function getDemoEvent(slug: string): DemoEvent | undefined {
  return demoEvents.find((e) => e.slug === slug);
}
