# Vinyl Night

Drop the needle. The tracklist writes itself.

A phone by the speaker samples the room once a minute, recognizes each record Shazam-style, and streams a live set log to everyone at the party. When the night ends, one click turns the log into a Spotify playlist. It's also a lightweight event page: details, lineup, RSVP — one link for the whole night.

## Quickstart

```bash
npm install
cp .env.example .env        # defaults to the mock provider — no API keys needed
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000 → **Host a night** → save the host link (it's your only key) → **Go live** from the console → open **the listener**, hit *Start listening*. With `RECOGNITION_PROVIDER=mock` every cycle "recognizes" a record from a fake crate (with the occasional simulated gap), so you can watch the full loop — live feed, projector view, set log, hide/unhide — without spending a cent.

## Real recognition

1. Grab a token at [audd.io](https://audd.io) (trial credits, then pay-as-you-go).
2. In `.env`: `RECOGNITION_PROVIDER=audd` and `AUDD_API_TOKEN=...`
3. ACRCloud is wired as an alternative (`RECOGNITION_PROVIDER=acrcloud` + the three ACR vars).

## Spotify export

Create an app in the [Spotify dashboard](https://developer.spotify.com/dashboard), add `http://localhost:3000/api/spotify/callback` as a redirect URI, and fill the `SPOTIFY_*` vars. In dev mode Spotify only lets **allowlisted accounts** authorize — add your account under *User Management*. Then: host console → *Connect Spotify* → *Export playlist*. Matching order per track: known Spotify ID → ISRC search → title/artist search; anything unmatched is listed instead of guessed.

## Environment

| Var | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite via Prisma |
| `RECOGNITION_PROVIDER` | `mock` | `mock` \| `audd` \| `acrcloud` |
| `AUDD_API_TOKEN` | — | required for `audd` |
| `CONFIDENCE_THRESHOLD` | `0.6` | skip matches below this (providers that score) |
| `DEDUPE_WINDOW_MIN` | `8` | same song within this window = one log entry |
| `ACRCLOUD_*` | — | host / access key / secret |
| `SPOTIFY_CLIENT_ID/SECRET` | — | from your Spotify app |
| `SPOTIFY_REDIRECT_URI` | localhost callback | must match the dashboard exactly |

## How it fits together

- **Capture** — `/host/e/[slug]/listen` records 12s of every 60s (MediaRecorder), holds a screen wake lock, shows a live mic meter, and backs off a cycle after repeated failures.
- **Recognize** — `POST /api/events/:id/recognize` runs the configured provider, logs every sample, applies dedupe (`src/lib/dedupe.ts`), and broadcasts new tracks on an in-process bus.
- **Live** — `GET /api/events/:id/stream` is SSE (hello frame + track/event frames + heartbeats). The client falls back to 20s polling if the stream can't hold.
- **Export** — host-only, cookie-held Spotify tokens, chunked playlist adds, unmatched tracks reported honestly.

Host auth is a per-event `hostKey` (returned exactly once at creation) — no accounts in v1.

## Deploying

SSE + the in-process event bus want a **persistent Node host** (Linode box, Fly, Railway, a `next start` behind Caddy). On serverless the app still works — clients just land on the polling fallback. Swap SQLite for Postgres by changing the datasource + `DATABASE_URL` when you outgrow one box.

### GitHub Pages (static demo)

GitHub Pages can't run the server side (API routes, SQLite, SSE), so `.github/workflows/deploy-pages.yml` publishes a **static demo** instead: the public pages rendered from fixture data in `src/lib/demo-fixtures.ts`, with the host console and APIs stripped. Pages is configured to serve the `docs/` folder on `main`; the workflow builds the demo on every push and commits the output there. Build it locally with `scripts/build-demo.sh` → `.demo-build/out`.

## Working on it with Claude Code

`PLAN.md` is the build plan; `.claude/agents/` ships five subagents (backend-dev, frontend-dev, integrations-dev, code-reviewer, qa-tester, all pinned to Opus). Phase prompts live in PLAN.md §8. `npm run test` (Vitest, pure logic) and `npm run build` are the gates.

## Test night checklist

PLAN.md §10 — short version: phone on a stand near a speaker, screen unlocked, listener started, projector view on the TV, export before everyone leaves.
