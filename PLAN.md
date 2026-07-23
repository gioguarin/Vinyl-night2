# Vinyl Night — Build Plan for Claude Code

A lightweight listening-party app: a Shazam-style listener samples the room every 60 seconds, builds the tracklist in real time, publishes a live "now playing" feed on the event page, and exports a playlist at the end. It doubles as the community event page (details, lineup, RSVP) so you're not dependent on Meetup/FB.

**How to use this file:** drop it in the repo root as `PLAN.md`, create the subagent files from §7 in `.claude/agents/`, then run the phase prompts in §8 one at a time inside Claude Code.

---

## 1. Product summary

Two modes, one app:

- **Event mode (always on):** public event page at `/e/[slug]` — title, date, venue, description, artist lineup, lightweight RSVP. Shareable link, no login for attendees.
- **Live mode (event day):** host opens a listener page on a phone/laptop near the speakers. Every 60s it records a ~12s clip, sends it for recognition, dedupes, and appends to the tracklist. Attendees on the event page see "Now Playing" + history update live. After the event: one-click Spotify playlist export + a permanent recap page.

**Roles:** Host (creates/manages events, runs listener, exports playlist) and Attendee (views public pages). Keep auth minimal for v1 — a per-event `hostKey` (random token in a signed cookie/localStorage) instead of full user accounts.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Familiar stack (Orbital CTF pattern) |
| DB/ORM | Prisma + SQLite (dev) → Postgres (prod) | Fast to iterate |
| UI | Tailwind + shadcn/ui | Familiar, fast |
| Audio capture | Web Audio / MediaRecorder API (browser) | No native app needed; host device is the mic |
| Recognition | **AudD** (primary), ACRCloud (adapter, optional) | AudD is a single POST with the audio file; returns title/artist/album, **ISRC, and direct Spotify/Apple Music IDs** — which makes playlist export nearly free. ACRCloud kept behind the same interface as fallback. |
| Realtime | SSE (Server-Sent Events), polling fallback | One-way server→client is all we need |
| Playlist | Spotify Web API (OAuth, playlist-modify scopes) | Export at event end |
| Deploy | Node server on Linode/Akamai Cloud (or Fly/Railway) | Long-lived SSE connections don't play well with serverless function timeouts — prefer a persistent Node process. If Vercel, swap SSE for 20s polling. |

---

## 3. Data model (Prisma)

```prisma
model Event {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  description String?
  venue       String?
  coverImage  String?
  startsAt    DateTime
  endsAt      DateTime?
  status      String   @default("upcoming") // upcoming | live | ended
  hostKey     String   @unique // random token; proves host identity
  artists     Artist[]
  tracks      Track[]
  rsvps       Rsvp[]
  samples     RecognitionSample[]
  createdAt   DateTime @default(now())
}

model Artist {
  id      String @id @default(cuid())
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name    String
  bio     String?
  links   Json?   // { instagram, soundcloud, bandcamp, ... }
  order   Int     @default(0)
}

model Track {
  id           String   @id @default(cuid())
  eventId      String
  event        Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  title        String
  artist       String
  album        String?
  artworkUrl   String?
  isrc         String?
  spotifyId    String?
  provider     String   // "audd" | "acrcloud" | "manual"
  confidence   Float?
  recognizedAt DateTime @default(now())
  hidden       Boolean  @default(false) // host can hide false positives
}

model RecognitionSample {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  matched   Boolean
  raw       Json?    // provider response, for debugging
  createdAt DateTime @default(now())
}

model Rsvp {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime @default(now())
}
```

---

## 4. Architecture

### Routes (pages)
- `/` — landing + list of upcoming events
- `/e/[slug]` — public event page (details, lineup, RSVP; when `status=live`, embeds the live feed; when `ended`, shows recap tracklist)
- `/e/[slug]/live` — full-screen live view (Now Playing card + history), optional projector mode
- `/host` — create event form (returns hostKey link)
- `/host/e/[slug]` — host console (edit event, lineup, manage tracks, go live/end, export playlist) — gated by hostKey
- `/host/e/[slug]/listen` — the **Listener**: mic capture loop UI

### API routes
- `POST /api/events` — create (generates slug + hostKey)
- `GET/PATCH /api/events/[id]` — read/update (PATCH requires hostKey)
- `POST /api/events/[id]/rsvp`
- `POST /api/events/[id]/recognize` — accepts audio blob (multipart), requires hostKey → provider → dedupe → insert Track → broadcast
- `GET /api/events/[id]/stream` — SSE feed of track events
- `GET /api/events/[id]/tracks` — polling fallback / recap data
- `PATCH /api/tracks/[id]` — hide/unhide/edit (hostKey)
- `GET /api/spotify/auth` + `/api/spotify/callback` — OAuth
- `POST /api/events/[id]/export` — create Spotify playlist from visible tracks

### Recognition pipeline (server)
1. Receive ~12s audio clip (webm/opus from MediaRecorder).
2. `RecognitionProvider` interface: `recognize(buffer): Promise<Match | null>`. Implement `AuddProvider` first; `AcrCloudProvider` optional behind env switch (`RECOGNITION_PROVIDER`).
3. Log a `RecognitionSample` (matched or not).
4. **Dedupe:** if match has same normalized `title+artist` as the most recent non-hidden Track within the last 8 minutes → skip (it's the same song still playing). Also skip if `confidence` below threshold.
5. Insert Track, broadcast `{type:"track", track}` on the event's SSE channel.

### Listener page (client)
- `getUserMedia({audio})` once; every 60s (setInterval) start a MediaRecorder for 12s, collect blob, POST it.
- Request a **Screen Wake Lock** so the phone doesn't sleep; re-acquire on `visibilitychange`.
- UI: big start/stop, live status log (matched / no match / error), last match card, sample counter, error backoff (skip a cycle after repeated failures).
- Show mic level meter so the host can position the device.

### SSE
- In-memory `EventEmitter` bus keyed by eventId (fine for single-instance deploy). Client `EventSource` with auto-reconnect; on connect, server sends current Now Playing + last 10 tracks so late joiners sync. Fallback: poll `/tracks` every 20s if `EventSource` errors.

### Playlist export
- Host connects Spotify (authorization code flow, `playlist-modify-public` or `-private`).
- For each visible track: use `spotifyId` from AudD directly; else search by ISRC (`isrc:XXXX`); else search `track:title artist:artist`, take top hit; flag unmatched for manual review.
- Create playlist named `"{Event Title} — {date}"`, add URIs in recognizedAt order, save playlist URL on the event, show it on the recap page.

---

## 5. Key decisions & risks

- **AudD pricing/keys:** requires an api_token; free tier is small — budget for event nights. Provider interface keeps you switchable.
- **Vinyl + crowd noise:** 12s samples, device near a speaker; the mic-level meter exists for this. Expect no-match gaps between songs and during talk breaks — that's fine, samples are logged either way.
- **Spotify dev mode:** new Spotify apps are restricted to allowlisted users until you request an extension. Fine for v1 (you're the only host) — add your account in the Spotify dashboard.
- **Serverless vs SSE:** if deploying to Vercel anyway, just ship the 20s polling path and skip SSE — don't fight the platform.
- **False positives:** host console lets you hide tracks; hidden tracks are excluded from feed + export.
- **hostKey security:** it's a bearer token in a URL — acceptable for v1, note it in README; upgrade path is real auth later.
- **Costs note:** running everything on Opus 4.8 subagents is token-heavy (subagent workflows can burn ~7x a single thread). You asked for Opus everywhere, so that's what §7 does — downgrade `code-reviewer`/`qa-tester` to `sonnet` later if bills annoy you.

---

## 6. V1 scope cuts (don't build these yet)

Multi-host accounts, attendee comments/reactions, Apple Music export, photo uploads, recurring events, email notifications, native app, multi-instance SSE (Redis pub/sub).

---

## 7. Subagents — paste into `.claude/agents/`

All pinned to Opus 4.8 via full model ID. Only `name` and `description` are required fields; `tools` is an allowlist (omit = inherit all).

### `.claude/agents/backend-dev.md`
```markdown
---
name: backend-dev
description: Implements Prisma schema, API routes, hostKey auth, SSE stream, and the recognition pipeline for Vinyl Night. Use for any server-side or database task.
tools: Read, Write, Edit, Bash, Glob, Grep
model: claude-opus-4-8
---
You are the backend engineer for Vinyl Night (Next.js App Router + Prisma + TypeScript).
Source of truth: PLAN.md §3 (data model), §4 (API routes, recognition pipeline, SSE).
Rules:
- Validate hostKey on every mutating route; return 401 otherwise.
- Recognition providers implement the RecognitionProvider interface in src/lib/recognition/; AudD first, selected via RECOGNITION_PROVIDER env var. Never hardcode API keys — use env vars and document them in .env.example.
- Implement dedupe exactly as PLAN.md §4 step 4 (same normalized title+artist within 8 min → skip; confidence threshold from env, default 0.6-equivalent).
- Log every sample to RecognitionSample, matched or not.
- After schema changes run `npx prisma migrate dev` and ensure `npm run build` passes before finishing.
- Keep handlers small; shared logic in src/lib/. Return typed JSON errors.
Finish each task with a short summary: files touched, env vars added, how to test.
```

### `.claude/agents/frontend-dev.md`
```markdown
---
name: frontend-dev
description: Builds all Vinyl Night pages and UI — public event page, live feed, host console, and the Listener capture page. Use for any React/UI/client-side task.
tools: Read, Write, Edit, Bash, Glob, Grep
model: claude-opus-4-8
---
You are the frontend engineer for Vinyl Night (Next.js App Router, Tailwind, shadcn/ui, TypeScript).
Source of truth: PLAN.md §4 (routes, Listener behavior, SSE client).
Rules:
- Mobile-first; the Listener and live feed will run on phones. Dark theme by default — this is a nighttime event app; give it a warm vinyl/analog feel (grain, amber accents), not a generic SaaS look.
- Listener page: getUserMedia once, 12s MediaRecorder clip every 60s, POST to /api/events/[id]/recognize, Screen Wake Lock with re-acquire on visibilitychange, mic level meter, status log, error backoff.
- Live feed: EventSource with reconnect, initial state hydration from the stream's hello message, polling fallback to /tracks every 20s on failure.
- Now Playing card: artwork, title, artist, "recognized Xm ago" — must look good projected.
- No form libraries; keep deps minimal. `npm run build` must pass before finishing.
Finish each task with: files touched, routes affected, how to test in the browser.
```

### `.claude/agents/integrations-dev.md`
```markdown
---
name: integrations-dev
description: Owns third-party integrations — AudD/ACRCloud recognition adapters and Spotify OAuth + playlist export. Use for anything touching external APIs.
tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: claude-opus-4-8
---
You are the integrations engineer for Vinyl Night.
Source of truth: PLAN.md §4 (recognition pipeline, playlist export) and §5 (risks).
Rules:
- Check current API docs with WebFetch before implementing (AudD api.audd.io, Spotify Web API) — endpoints and auth flows drift.
- AudD adapter: multipart POST with the audio file + api_token; map response to the Match type incl. ISRC and spotify id when present.
- Spotify: authorization code flow, store tokens server-side keyed to the event's hostKey session, refresh handling, playlist-modify scope only.
- Export matching order: spotifyId → ISRC search → title/artist search → mark unmatched. Never guess a wrong track silently; return the unmatched list.
- All secrets via env vars, documented in .env.example. Handle rate limits with retry + jitter.
Finish with: files touched, env vars, a curl example or test script for each integration.
```

### `.claude/agents/code-reviewer.md`
```markdown
---
name: code-reviewer
description: Read-only review of recent changes for correctness, security, and PLAN.md conformance. Use proactively after each phase completes.
tools: Read, Grep, Glob, Bash
model: claude-opus-4-8
---
You are a strict code reviewer for Vinyl Night. Review the most recent diff (git diff / git log).
Check, in priority order:
1. Security: hostKey enforced on all mutating routes; no secrets in client bundles or committed files; audio upload size limits; no injection via slug/params.
2. Correctness vs PLAN.md: dedupe window, confidence threshold, SSE hello/hydration, export matching order.
3. Client resilience: wake lock re-acquire, EventSource reconnect, polling fallback, MediaRecorder cleanup (no leaked streams).
4. Quality: typed responses, no dead code, migrations consistent with schema.
Report issues by severity (blocker/major/minor) with file:line and a suggested fix. Do not modify files.
```

### `.claude/agents/qa-tester.md`
```markdown
---
name: qa-tester
description: Writes and runs tests for Vinyl Night — unit tests for dedupe/provider parsing/export matching, and API route tests. Use at the end of each phase.
tools: Read, Write, Edit, Bash, Glob, Grep
model: claude-opus-4-8
---
You are the QA engineer for Vinyl Night. Use Vitest.
Priorities:
1. Unit: dedupe logic (consecutive same-track, 8-min window edges, confidence threshold), title/artist normalization, AudD response parsing (match, no-match, malformed), Spotify export matcher fallback chain.
2. API: recognize route auth (401 without hostKey), RSVP, tracks listing, hide/unhide.
3. Mock all external APIs — never hit AudD/Spotify in tests.
Run the suite; fix flaky setup, not product code — report product bugs instead of silently patching them.
Finish with: pass/fail summary and any bugs found.
```

---

## 8. Build phases — run these in Claude Code, in order

**Phase 0 — Scaffold (main thread, no subagent):**
> Read PLAN.md fully. Scaffold a Next.js App Router TypeScript project with Tailwind, shadcn/ui, Prisma (SQLite for dev), and Vitest. Create the Prisma schema from PLAN.md §3, run the initial migration, add .env.example with placeholders (DATABASE_URL, AUDD_API_TOKEN, RECOGNITION_PROVIDER, CONFIDENCE_THRESHOLD, SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI), and set up src/lib/ structure. Commit.

**Phase 1 — Event manager:**
> Use the backend-dev subagent to implement event CRUD, slug generation, hostKey auth, and RSVP per PLAN.md §4. Then use the frontend-dev subagent to build /, /e/[slug], /host, and /host/e/[slug] (event + lineup editing). Then use the code-reviewer subagent on the diff.

**Phase 2 — Recognition engine:**
> Use the integrations-dev subagent to build the RecognitionProvider interface and AudD adapter. Then use the backend-dev subagent to implement POST /api/events/[id]/recognize with dedupe and sample logging per PLAN.md §4. Then use the frontend-dev subagent to build /host/e/[slug]/listen (capture loop, wake lock, level meter, status log). Then code-reviewer on the diff.

**Phase 3 — Live feed:**
> Use the backend-dev subagent to implement the SSE stream (/api/events/[id]/stream with hello hydration) and GET /tracks. Then use the frontend-dev subagent to build the live feed on /e/[slug] and /e/[slug]/live (Now Playing card, history, reconnect + polling fallback) and the host's go-live/end controls including track hide/unhide. Then code-reviewer.

**Phase 4 — Playlist export + recap:**
> Use the integrations-dev subagent to implement Spotify OAuth and POST /api/events/[id]/export with the matching fallback chain. Then use the frontend-dev subagent to build the recap state of /e/[slug] (final tracklist, playlist link, unmatched tracks list for the host). Then code-reviewer.

**Phase 5 — QA + hardening:**
> Use the qa-tester subagent to write and run the test suite per its instructions. Fix reported bugs with backend-dev/frontend-dev as appropriate, then a final code-reviewer pass. Write a README covering setup, env vars, AudD signup, Spotify app setup (dev-mode allowlist note), and deploy notes for a persistent Node host (Linode/Fly) vs Vercel polling mode.

**Definition of done (v1):** create an event → share `/e/[slug]` → RSVP works → go live → listener on a phone recognizes real records with dedupe → attendees see live feed update → end event → export Spotify playlist → recap page is permanent.

---

## 9. Test night checklist (real-world validation)

- Phone on charger, wake lock confirmed, positioned near speaker
- Play 3–4 records incl. one obscure pressing (expect a no-match — verify graceful gap)
- Second phone on the live feed over cellular (not venue wifi)
- Kill/restore wifi on listener mid-event → verify backoff + recovery
- Export playlist, check track order and the unmatched list
