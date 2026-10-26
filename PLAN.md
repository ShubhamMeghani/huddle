# Huddle: Build Plan (PLAN.md)

> **Spec:** [SPEC.md](SPEC.md) **v0.4**, which has 94 requirements and 89 acceptance criteria; §11 lists the binding decisions.
> **Plan version:** 2 · 2026-10-22. Changelog at the end.

## Stack

The full stack is in SPEC §3:

- Next.js App Router with TypeScript (strict), Tailwind CSS, Node.js 24.
- Neon Postgres through `pg` everywhere; on Vercel over TCP to the pooled endpoint with `attachDatabasePool` (SPEC v0.4).
- Ably for realtime. Browsers get subscribe-only tokens; a local SSE driver replaces Ably in test mode.
- Auth.js v5 with optional Google sign-in.
- Vitest and Playwright.
- Vercel Hobby, **Git-connected** to `github.com/ShubhamMeghani/huddle`. Production deploys only when the owner pushes `main`.
- GitHub Actions on `ubuntu-24.04`.

## Test commands

| Command | What it runs |
|---|---|
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Vitest: unit tests, content checks, and API and DB code against a **throwaway local Postgres** (`embedded-postgres`, or `TEST_DATABASE_URL` in CI) with a fresh database per run |
| `npm test -- -t "AC-14\b"` | One Unit AC. Every AC test's name starts with its ID. |
| `npm run check:content` | Content-bank checks only (SPEC §4.8) |
| `npm run test:e2e` | Playwright `android` (Chromium, Pixel 7) and `iphone` (WebKit, iPhone 14) projects against a **local production build** (`next build` + `next start`) in test mode: local Postgres, `REALTIME_DRIVER=local`, seeded RNG, short timers |
| `npm run test:e2e -- --grep "AC-16\b"` | One E2E AC, in both projects |
| `npm run test:real` | Real-services check: a local production build with **real Ably and the Neon `dev` branch** (env from `.env.local`), running `tests/deploy` at `http://localhost:3000` |
| `npm run test:deploy` | `tests/deploy` against `DEPLOY_URL` (production). Only after the owner pushes. |
| `npm run probe:draw` | Drawing-throughput probe (local production build with real Ably, or `DEPLOY_URL`). Appends to `docs/deploy-checks.md`. |
| `npm run db:migrate` | Applies `db/migrations` to the database in `.env.local` (Neon `dev`) via `node --env-file`. Production migrates during the Vercel build. |
| `npm run env:check` | Prints each required variable **name** with `set` or `MISSING`. Never prints values. |
| `npm run ci` | lint → typecheck → test → build → test:e2e: everything GitHub Actions runs, in one process. This is the **full suite run before every commit**. (Actions splits it into a `checks` job and parallel `e2e` jobs for `android` and `iphone`.) |

## Rules for the autonomous build

1. **Order.** Do the phases in order, and the tasks within a phase in order. A phase is done when every "Done when" AC passes with its proof command and `npm run ci` is green on the local production build.
2. **One commit per phase.** Commit at the end of the phase with `feat(phase-N): <summary>` and a `Refs:` line listing the R# and AC-# IDs. The commit includes this file's updated tables.
   - Run the full suite (`npm run ci`) before every commit.
   - **Never push.** Never amend, rebase or force.
   - Never stage `.env*`, `.vercel/`, `.cache/` or local database files.
3. **Secrets.**
   - Never read, open, `cat`, grep or print `.env.local` or any environment value.
   - Env is loaded only by `node --env-file` / `process.loadEnvFile`, Next.js, Vitest or Vercel.
   - To check configuration, use `npm run env:check` (names only).
   - Never ask the user to paste a secret.
4. **When to stop.**
   - **Stop only if a SPEC requirement or AC must change.** Write the proposal under [Blockers](#blockers) (ID, current text, proposed text, reason, impact). Do not edit SPEC.md and do not commit the unfinished phase. Stop and report.
   - Decide everything else yourself, and log notable choices in the [Decision log](#decision-log).
5. **Tests are the referee.** Never delete, skip, `.only`, loosen or re-time a test just to get green. Flaky tests get fixed. The only retry is Playwright `retries: 1` in CI.
6. **No deploys.** The builder never runs the Vercel CLI and never deploys; Vercel deploys when the owner pushes. Each phase is verified on the local production build. Real Ably and Neon are checked with `npm run test:real`. Checks that need production, Google credentials or a phone are marked **`Pending (human)`** and the build continues without waiting.
7. **Bookkeeping.** At the end of each phase, update the [AC table](#acceptance-criteria-status) (status, evidence, commit) and the [phase board](#phase-board).

## Phase board

| Phase | Name | Mode | Status | Commit |
|---|---|---|---|---|
| 1 | Deployment skeleton | AUTO (human steps after) | done | 3a4168a |
| 2 | Core engine: rooms, sync, rejoin, timers, AFK, admin, queue | AUTO | done | 431c22e |
| 3 | Teams and ratings | AUTO | done | d368335 |
| 4 | Quiz Clash | AUTO | done | 30524a7 |
| 5 | Draw & Guess | AUTO | done | e5ee1b7 |
| 6 | Imposter | AUTO | done | a25a2f0 |
| 7 | Atlas | AUTO | done | f52618c |
| 8 | Dumb Charades | AUTO | done | ad25162 |
| 9 | Most Likely To (Should) and cross-game suites | AUTO | done | bc8f1ad |
| 10 | Crews, rankings, awards, recap card | AUTO | done | 9358d76 |
| 11 | Leaderboard button and big screen | AUTO | done | 6811ed5 |
| 12 | Demo with bots | AUTO | done | ae34a0d |
| 13 | Design and PWA (iPhone-first) | AUTO | done | 8d721a5 |
| 14 | Privacy page | AUTO | done | bf25834 |
| 15 | Full multi-player E2E suite and verification | AUTO | done | phase-15 commit |
| 16 | Human steps and acceptance | HUMAN, then AUTO | todo | – |

If time runs short, cut Should items in this order: recap card (10.7) → big screen (11.2) → Most Likely To (9.1–9.2). Log each cut and mark its ACs `cut`. The steal rule (R65) is a Must, so cutting it would be a SPEC change (rule 4).

---

## Your steps, in order

| # | When | Step | Status |
|---|---|---|---|
| H1 | before Phase 1 | Neon project `huddle` in AWS US East 1 with `main` and `dev` branches and pooled strings | **done** |
| H2 | before Phase 1 | Ably app `huddle` with key `huddle-server` (Publish, Subscribe, Statistics only) | **done** |
| H3 | before Phase 1 | `.env.local` with `DATABASE_URL` (Neon dev, pooled), `ABLY_API_KEY` and `AUTH_SECRET`; Google values empty | **done** |
| H4 | after Phase 1 | Import the project into Vercel from GitHub and set its env vars (details below) | **done** |
| H5 | after H4 | Create the Google OAuth client (details below) | **done** |
| H6 | after H5, and whenever you like | `git push` (this deploys production) and run the production checks | **done** (production checks run 2026-10-26; AC-80 re-check after the next push) |
| H7 | after Phase 15 | Install on an Android phone (required) | Pending (human) |
| H8 | after Phase 15 | Playtest with friends, including an iPhone if a friend has one | Pending (human) |

**H4: Vercel import (about 5 min)**

1. On vercel.com, click **Add New → Project → Import Git Repository** and pick `ShubhamMeghani/huddle`.
2. Framework preset: **Next.js**. Leave the build settings at their defaults; `vercel.json` sets the build and region.
3. Before clicking Deploy, open **Environment Variables** and add:

| Variable | Production | Preview |
|---|---|---|
| `DATABASE_URL` | Neon **main** pooled string | Neon **dev** pooled string |
| `ABLY_API_KEY` | `huddle-server` key | same key |
| `AUTH_SECRET` | a new `openssl rand -base64 32` value | another new value |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | added in H5 | leave unset (preview URLs can't use Google sign-in) |

Never set `HUDDLE_TEST_MODE`, `REALTIME_DRIVER`, `TEST_DATABASE_URL` or `DEPLOY_URL` in Vercel.

4. Click **Deploy**.
5. Under **Settings → Domains**, add or rename the production domain, for example `huddle-<unique>.vercel.app`. This is **`<prod-domain>`** below.
6. Function region `iad1` comes from `vercel.json`.

**H5: Google OAuth (about 10 min)**

1. Go to console.cloud.google.com → **New project** named `huddle-auth`, and select it.
2. **Google Auth Platform → Get started:**
   - App name `Huddle`
   - Support email: yours
   - Audience: **External**
   - Contact email: yours
3. **Branding:**
   - Home page: `https://<prod-domain>`
   - Privacy policy: `https://<prod-domain>/privacy`
   - Authorized domain: `<prod-domain>`
   - No logo.
4. **Data access:** add the scopes `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
5. **Clients → Create client → Web application** named `Huddle web`:
   - Authorized JavaScript origins: `http://localhost:3000` and `https://<prod-domain>`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<prod-domain>/api/auth/callback/google`
6. Put the client ID and secret into Vercel **Production** (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) and into `.env.local`.
7. **Audience → Publish app.** `/privacy` is already live from the H4 deploy.

**H6: Push and production checks**

1. Run `git push origin main`. Vercel builds, migrates Neon `main` and deploys.
2. Run the production checks:
   ```
   DEPLOY_URL=https://<prod-domain> npm run test:deploy
   DEPLOY_URL=https://<prod-domain> npm run probe:draw
   ```
   Or ask Claude to run them.
3. GitHub Actions runs CI on each push; that is the evidence for AC-76.

**H7: Android install (required).** In Chrome, open `https://<prod-domain>` → menu → **Install app**. Launch it from the home screen and join a room.

**H8: Playtest.**
- ≥ 4 friends on their own phones, ≥ 3 games.
- Lock one phone, refresh one, and turn Wi-Fi off and on for one.
- One player signs in with Google.
- **If a friend has an iPhone:** in Safari, open the app, play one game, then Share → **Add to Home Screen** and launch it.
- Write the findings in `docs/playtest.md`, or tell Claude.

---

## Phase 1: Deployment skeleton

**Goal:** prove every risky piece before any game is built (SPEC §7). Proofs run on a local production build against real Ably and Neon `dev`. The production versions are `Pending (human)` until H4–H6.

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 1.1 | **Scaffold:**<br>• Next.js (App Router, TS strict), Tailwind, ESLint, Vitest, Playwright (`android`, `iphone` and `deploy` projects)<br>• npm scripts, `.env.example` (names only)<br>• `vercel.json` (region `iad1`, build = migrate + `next build`, daily cleanup cron)<br>• `engines.node 24.x`, README skeleton<br>• Light-default theme tokens with a dark toggle stub<br>• iOS-safe shell (`dvh`, safe-area insets) | AUTO | R36, R37, R90 | `npm run lint && npm run typecheck && npm run build` |
| 1.2 | `env:check` (names only) and a gate on `DATABASE_URL`, `ABLY_API_KEY` and `AUTH_SECRET` | AUTO | – | `npm run env:check` |
| 1.3 | CI workflow: ubuntu-24.04, Node 24, a Postgres service, Playwright Chromium and WebKit, sentinel secrets, `npm run ci` | AUTO | R90 | `npm run ci` green locally; AC-76 after H6 |
| 1.4 | **Database:**<br>• `db.ts` (Neon serverless on Vercel, `pg` elsewhere)<br>• Migration runner with a transaction lock<br>• `001_core.sql`<br>• Local Postgres harness for tests and E2E | AUTO | R11 | `npm test -- -t "migrations"` |
| 1.5 | **Test mode:** a guard that refuses when `VERCEL_ENV` is set; seeded RNG; short timers; drop-message hook; test Credentials provider; local SSE realtime driver | AUTO | R4 | AC-6 |
| 1.6 | **Guest identity:** name validation, `huddle_dt` cookie | AUTO | R1 | AC-1, AC-2 |
| 1.7 | **Ably driver:** REST publish, subscribe-only TokenRequest endpoint (60 min TTL, `authUrl` renewal) | AUTO | R4 | AC-5 |
| 1.8 | **Auth.js v5:** Google provider only when `AUTH_GOOGLE_ID` is set; JWT sessions; users upsert; test provider | AUTO | R2 | AC-3 |
| 1.9 | **Skeleton room:**<br>• Create with code, link and QR; join<br>• "+1" counter through the full pipeline (lock, version, idempotent `actionId`, publish after commit)<br>• Snapshot, gap → snapshot, reload restore<br>• Minimal `/privacy` | AUTO | R5, R6, R11–R15, R93 | `npm run test:e2e -- --grep @skeleton` |
| 1.10 | **Strokes and probe:**<br>• Strokes endpoint (idempotent `seq`, 8 KB and rate caps)<br>• `scripts/probe-draw.ts` replays an 80 s drawing with 6 viewers and 1 screen subscriber, and records rate, sizes, errors and Ably stats<br>• Record the current Ably Free limits (source URL and date) in `docs/deploy-checks.md` | AUTO | R70 | AC-81 (local probe) |
| 1.11 | **Real-services proof** with `npm run test:real`:<br>• Ably token auth and update latency (AC-77 local)<br>• Neon `dev` survives a restart (AC-78 local)<br>• 6 browsers (2 Chromium, 2 Firefox, 2 WebKit) in one skeleton room<br>• Results in `docs/deploy-checks.md` | AUTO | R4, R8, R11, R15 | `npm run test:real` |
| 1.12 | Production versions of AC-77, AC-78 and AC-79, the six-browser skeleton check and the probe | **Pending (human)** after H4–H6 | R2, R4, R8 | `npm run test:deploy` |

**Done when:** AC-1, AC-2, AC-3, AC-5, AC-6, the local `test:real` proofs and the local probe.
**Proof:**
- `npm test -- -t "AC-(1|5)\b"`
- `npm run test:e2e -- --grep "AC-(2|3|6)\b|@skeleton"`
- `npm run test:real`
- `npm run probe:draw`
- `npm run ci`

**Commit:** `feat(phase-1): deployment skeleton with CI, DB, realtime, auth and probe`

---

Phases 2–15 are **[AUTO]** and run unattended. Each one ends with `npm run ci`, then updates the AC table and phase board, then makes one commit.

## Phase 2: Core engine

The engine is tested with an internal `ping` game (turn-based and simultaneous modes) that exists only in test mode.

| # | Task | Refs | Done when |
|---|---|---|---|
| 2.1 | Room state, game-module interface and the `ping` game. Pipeline: catch-up, error codes, notices, `privateFor`. | R11, R12 | AC-13 and AC-14 (engine part) |
| 2.2 | **Rooms:** code alphabet and retry, QR, join by link or code, not-found page, 12-seat cap, spectators and screens (Q8), late-join seating, kick, lazy expiry and daily cleanup | R5–R10 | AC-7, AC-8, AC-9, AC-10, AC-12 |
| 2.3 | **Views and sync:** public and private views, snapshot route; client store with version gaps, reconnect/visible/focus/online, heartbeat, polling fallback and "Reconnecting…" pill | R13, R14, R16, R35 | AC-16 |
| 2.4 | **Rejoin and seat reclaim:** restore by token or profile; "That's me" approval | R15, R17 | AC-21 |
| 2.5 | **Timers:** deadlines, clock offset, countdown, tick, catch-up, auto-pause, pause/resume | R18–R20, R23 | AC-22, AC-23, AC-24, AC-25, AC-28 |
| 2.6 | **AFK:** missed turns, badge, skips, "I'm back" | R21, R22 | `ping` unit tests |
| 2.7 | **Admin:** controls, notices, undo, auto hand-off, settings lock | R24–R27 | AC-29, AC-30, AC-31 |
| 2.8 | **Queue and night:** house-rules framework, break, End night, rematch, results recording | R28–R31, R45 | AC-48 |
| 2.9 | **Rate limits** | R46 | AC-49 |
| 2.10 | **App shell:** home, lobby, turn status bar, vibration hook (silent where unsupported), How-to-play sheet | R37, R39, R40, R42 | AC-43 |

**Done when:** AC-7, AC-8, AC-9, AC-10, AC-12, AC-16, AC-21, AC-22, AC-23, AC-24, AC-25, AC-28, AC-29, AC-30, AC-31, AC-43, AC-48, AC-49.
**Proof:**
- `npm test -- -t "AC-(7|10|22|24|25|28|30|48|49)\b"`
- `npm run test:e2e -- --grep "AC-(8|9|12|16|21|23|29|31|43)\b"`
- `npm run ci`

## Phase 3: Teams and ratings

| # | Task | Refs | Done when |
|---|---|---|---|
| 3.1 | Ratings table; multiplayer Elo applied once per game | R33 | AC-37 |
| 3.2 | Balancing: snake draft plus swaps | R32 | AC-35 |
| 3.3 | Lobby team UI: move, shuffle, rebalance; late joiners go to the smallest team | R32, R9 | AC-36 |

**Done when:** AC-35, AC-36, AC-37.
**Proof:**
- `npm test -- -t "AC-(35|37)\b"`
- `npm run test:e2e -- --grep "AC-36\b"`
- `npm run ci`

## Phase 4: Quiz Clash

| # | Task | Refs | Done when |
|---|---|---|---|
| 4.1 | `content/quiz.json` (≥ 400, ≥ 40 per category) and checks | R56 | AC-56 |
| 4.2 | Rules: single lock-in, early end, scoring, team averages, no repeats | R57–R59, R61 | AC-57 |
| 4.3 | Reports, exclusion at 3, `export-reports.ts` | R60 | AC-59 |
| 4.4 | View (answer hidden until reveal), bot, How-to-play, UI | R34, R42, R44 | AC-38 (Quiz fixtures) |
| 4.5 | E2E: flow, late joiner, offline, polling-only client | R9, R15, R16 | AC-58, AC-11, AC-19, AC-20 |

**Done when:** AC-11, AC-19, AC-20, AC-56, AC-57, AC-58, AC-59.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(56|57|59)\b"`
- `npm run test:e2e -- --grep "AC-(11|19|20|58)\b"`
- `npm run ci`

## Phase 5: Draw & Guess

| # | Task | Refs | Done when |
|---|---|---|---|
| 5.1 | `content/draw-words.json` (≥ 500, ≥ 75 `india`) and checks | R67 | AC-63 |
| 5.2 | Stroke codec, RDP, batching | R70 | AC-64 |
| 5.3 | Rules: choices, mask, hints, guesses, close guesses, scoring, chat visibility, rounds | R68, R71–R75 | AC-65 |
| 5.4 | Canvas UI with pointer events and `touch-action: none`: no scroll or zoom on iOS; tools; replay and catch-up | R69, R70 | AC-88 |
| 5.5 | Bot and `bot-drawings.json` (≥ 20); How-to-play | R42, R44 | unit test |
| 5.6 | E2E: draw flow, rejoin, AFK drawer, hostless queue | R15, R21, R28 | AC-66, AC-17, AC-26, AC-33 |

**Done when:** AC-17, AC-26, AC-33, AC-63, AC-64, AC-65, AC-66, AC-88.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(63|64|65)\b"`
- `npm run test:e2e -- --grep "AC-(17|26|33|66|88)\b"`
- `npm run ci`

## Phase 6: Imposter

| # | Task | Refs | Done when |
|---|---|---|---|
| 6.1 | `content/imposter-pairs.json` (≥ 150, with hints) and checks | R82 | AC-71 |
| 6.2 | Rules (Q2: imposter not told by default) | R83–R87 | AC-72 |
| 6.3 | UI, bot, How-to-play | R42, R44 | AC-38 (Imposter fixtures) |
| 6.4 | E2E: 5-player seeded round | R83–R87 | AC-73 |

**Done when:** AC-71, AC-72, AC-73.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(71|72)\b"`
- `npm run test:e2e -- --grep "AC-73\b"`
- `npm run ci`

## Phase 7: Atlas

| # | Task | Refs | Done when |
|---|---|---|---|
| 7.1 | `scripts/build-places.ts` (GeoNames dumps into `.cache/`, filtered per Q5) → `data/places.json`, with attribution | R76 | AC-67 |
| 7.2 | Validation, variants, letter fallback | R77, R78, R81 | AC-68 |
| 7.3 | Accept vote, lives, scoring | R79, R80 | AC-69 |
| 7.4 | UI, bot, E2E, AFK across games, concurrent turn claims | R12, R21 | AC-70, AC-27, AC-14 |

**Done when:** AC-14, AC-27, AC-67, AC-68, AC-69, AC-70.
**Proof:**
- `npm test -- -t "AC-(14|27|67|68|69)\b"`
- `npm run test:e2e -- --grep "AC-70\b"`
- `npm run ci`

## Phase 8: Dumb Charades

| # | Task | Refs | Done when |
|---|---|---|---|
| 8.1 | `content/movies.json` (≥ 200 + 200) and checks | R62 | AC-60 |
| 8.2 | Rules: rotation, Guessed/Pass, steal, rounds | R63–R66 | AC-61 |
| 8.3 | UI, bot, E2E, queue and rematch | R29–R31 | AC-62, AC-34 |

**Done when:** AC-34, AC-60, AC-61, AC-62.
**Proof:**
- `npm test -- -t "AC-(60|61)\b"`
- `npm run test:e2e -- --grep "AC-(34|62)\b"`
- `npm run ci`

## Phase 9: Most Likely To (Should) and cross-game suites

| # | Task | Refs | Done when |
|---|---|---|---|
| 9.1 | Prompts (≥ 150); rules with an anonymous tally (Q6: night stats only) | R88, R89 | AC-74 |
| 9.2 | Reveal UI, bot, E2E | R88, R89 | AC-75 |
| 9.3 | Cross-game suites: invalid actions, view size, rejoin regression, settings, secret fixtures, How-to-play | R11, R13, R15, R27, R34, R42 | AC-13, AC-15, AC-18, AC-32, AC-38, AC-46 |

**Done when:** AC-13, AC-15, AC-18, AC-32, AC-38, AC-46, AC-74, AC-75.
**Proof:**
- `npm test -- -t "AC-(13|15|18|32|38|46|74)\b"`
- `npm run test:e2e -- --grep "AC-75\b"`
- `npm run ci`

## Phase 10: Crews, rankings, awards, recap card

| # | Task | Refs | Done when |
|---|---|---|---|
| 10.1 | Crews, invite link, link a room to a crew (Q4) | R47, R48 | AC-50 |
| 10.2 | Placement points, IST month seasons (Q1), leaderboard | R49 | AC-51 |
| 10.3 | Per-game stats, head-to-head | R50 | AC-52 |
| 10.4 | History pages | R51 | AC-50 |
| 10.5 | Awards | R52 | AC-53 |
| 10.6 | Claim guest games (Q3) | R3 | AC-4 |
| 10.7 | Recap card (Should) | R53 | AC-54 |

**Done when:** AC-4, AC-50, AC-51, AC-52, AC-53, AC-54.
**Proof:**
- `npm test -- -t "AC-(4|51|52|53)\b"`
- `npm run test:e2e -- --grep "AC-(50|54)\b"`
- `npm run ci`

## Phase 11: Leaderboard button and big screen

| # | Task | Refs | Done when |
|---|---|---|---|
| 11.1 | Leaderboard button and overlay | R38 | AC-42 |
| 11.2 | `/screen` big screen (Should) | R54, R55 | AC-55 |

**Done when:** AC-42, AC-55.
**Proof:**
- `npm run test:e2e -- --grep "AC-(42|55)\b"`
- `npm run ci`

## Phase 12: Demo with bots

| # | Task | Refs | Done when |
|---|---|---|---|
| 12.1 | `/demo` room with 4 bots, linked from home | R43 | AC-47 |
| 12.2 | Bot scheduling, game picker, short timers | R44 | AC-47 |

**Done when:** AC-47.
**Proof:**
- `npm run test:e2e -- --grep "AC-47\b"`
- `npm run ci`

## Phase 13: Design and PWA (iPhone-first)

| # | Task | Refs | Done when |
|---|---|---|---|
| 13.1 | Bright light tokens, dark theme, game accents, contrast test | R36, R91 | AC-83 |
| 13.2 | Avatars | R91 | AC-84 |
| 13.3 | Celebrations with a reduced-motion path | R92 | AC-85 |
| 13.4 | UI pass at 360 px and on iPhone: `dvh`, safe areas, 48 px targets, axe contrast | R36, R37 | AC-40, AC-41 |
| 13.5 | PWA: manifest, icons including the 180 px `apple-touch-icon`, Apple meta tags, service worker, offline screen | R41 | AC-44 |

**Done when:** AC-40, AC-41, AC-44, AC-83, AC-84, AC-85.
**Proof:**
- `npm test -- -t "AC-83\b"`
- `npm run test:e2e -- --grep "AC-(40|41|44|84|85)\b"`
- `npm run ci`

## Phase 14: Privacy page

| # | Task | Refs | Done when |
|---|---|---|---|
| 14.1 | Final `/privacy`, with Contact linking to `https://github.com/ShubhamMeghani/huddle/issues`; About page with GeoNames attribution | R93, R76 | AC-86 |

**Done when:** AC-86.
**Proof:**
- `npm run test:e2e -- --grep "AC-86\b"`
- `npm run ci`

## Phase 15: Full multi-player E2E suite and verification

| # | Task | Refs | Done when |
|---|---|---|---|
| 15.1 | Secret payload sniffing across all games | R34, R35 | AC-39 |
| 15.2 | Full-night 8-context regression (reloads, offline, AFK, admin leaves); E2E suite green 3 times in a row on both projects | R15, R16, R21, R26, R28 | `npm run test:e2e -- --repeat-each=3` |
| 15.3 | Real-services re-run (`test:real` with Quiz and Draw, probe on the real Draw flow). Production AC-77–AC-81 and AC-87 stay `Pending (human)` until H6. | R4, R11, R43, R70 | `npm run test:real` |
| 15.4 | README; AC table complete | R90 | table |

**Done when:** AC-39, the local real-services re-run, and every AC not waiting on a human is `pass`.

## Phase 16: Human steps and acceptance

H4 → H5 → H6 → H7 → H8 (above), then task 16.1 [AUTO]: run `npm run test:deploy` and `probe:draw` against production, fix findings that don't change SPEC, and record AC-45, AC-76, AC-77–AC-82 and AC-87.

**Done when:** AC-45, AC-76, AC-77, AC-78, AC-79, AC-80, AC-81, AC-82, AC-87.

---

## Acceptance criteria status

Status is one of `todo`, `pass`, `fail`, `Pending (human)` or `cut`. Evidence is the test file plus the commit hash once the AC passes.

| ID | Type | Phase | Status | Evidence |
|---|---|---|---|---|
| AC-1 | Unit | 1 | pass | `tests/unit/identity.test.ts` · pass @ phase-1 |
| AC-2 | E2E | 1 | pass | `tests/e2e/identity.spec.ts` · pass @ phase-1 |
| AC-3 | E2E | 1 | pass | `tests/e2e/auth.spec.ts` · pass @ phase-1 |
| AC-4 | Unit | 10 | pass | `tests/unit/claim.test.ts` · pass @ phase-10 |
| AC-5 | Unit | 1 | pass | `tests/unit/realtime-token.test.ts` · pass @ phase-1 (+ 401/403 in tests/e2e/secrets-scan.spec.ts) |
| AC-6 | E2E | 1 | pass | `tests/e2e/secrets-scan.spec.ts` · pass @ phase-1 |
| AC-7 | Unit | 2 | pass | `tests/unit/room-code.test.ts` · pass @ phase-2 |
| AC-8 | E2E | 2 | pass | `tests/e2e/rooms.spec.ts` · pass @ phase-2 |
| AC-9 | E2E | 2 | pass | `tests/e2e/rooms.spec.ts` · pass @ phase-2 |
| AC-10 | Unit | 2 | pass | `tests/unit/expiry.test.ts` · pass @ phase-2 |
| AC-11 | E2E | 4 | pass | `tests/e2e/quiz.spec.ts` · pass @ phase-4 |
| AC-12 | E2E | 2 | pass | `tests/e2e/admin.spec.ts` · pass @ phase-2 |
| AC-13 | Unit | 9 | pass | `tests/unit/games/invalid-actions.test.ts` · pass @ phase-9 (6 games, via the DB pipeline) |
| AC-14 | Unit | 7 | pass | `tests/unit/pipeline.test.ts` · pass @ phase-7 (incl. Atlas clause) |
| AC-15 | Unit | 9 | pass | `tests/unit/views.test.ts` · pass @ phase-9 |
| AC-16 | E2E | 2 | pass | `tests/e2e/sync.spec.ts` · pass @ phase-2 |
| AC-17 | E2E | 5 | pass | `tests/e2e/draw-rejoin.spec.ts` · pass @ phase-5 |
| AC-18 | Unit | 9 | pass | `tests/unit/rejoin.test.ts` · pass @ phase-9 |
| AC-19 | E2E | 4 | pass | `tests/e2e/reconnect.spec.ts` · pass @ phase-4 |
| AC-20 | E2E | 4 | pass | `tests/e2e/reconnect.spec.ts` · pass @ phase-4 |
| AC-21 | E2E | 2 | pass | `tests/e2e/reclaim.spec.ts` · pass @ phase-2 |
| AC-22 | Unit | 2 | pass | `tests/unit/clock.test.ts` · pass @ phase-2 |
| AC-23 | E2E | 2 | pass | `tests/e2e/clock.spec.ts` · pass @ phase-2 |
| AC-24 | Unit | 2 | pass | `tests/unit/timers.test.ts` · pass @ phase-2 |
| AC-25 | Unit | 2 | pass | `tests/unit/timers.test.ts` · pass @ phase-2 |
| AC-26 | E2E | 5 | pass | `tests/e2e/afk.spec.ts` · pass @ phase-5 |
| AC-27 | Unit | 7 | pass | `tests/unit/afk.test.ts` · pass @ phase-7 |
| AC-28 | Unit | 2 | pass | `tests/unit/timers.test.ts` · pass @ phase-2 |
| AC-29 | E2E | 2 | pass | `tests/e2e/admin.spec.ts` · pass @ phase-2 |
| AC-30 | Unit | 2 | pass | `tests/unit/undo.test.ts` · pass @ phase-2 (tests/unit/engine-admin.test.ts) |
| AC-31 | E2E | 2 | pass | `tests/e2e/admin.spec.ts` · pass @ phase-2 |
| AC-32 | Unit | 9 | pass | `tests/unit/settings.test.ts` · pass @ phase-9 |
| AC-33 | E2E | 5 | pass | `tests/e2e/hostless.spec.ts` · pass @ phase-5 |
| AC-34 | E2E | 8 | pass | `tests/e2e/queue.spec.ts` · pass @ phase-8 |
| AC-35 | Unit | 3 | pass | `tests/unit/teams.test.ts` · pass @ phase-3 |
| AC-36 | E2E | 3 | pass | `tests/e2e/teams.spec.ts` · pass @ phase-3 |
| AC-37 | Unit | 3 | pass | `tests/unit/ratings.test.ts` · pass @ phase-3 |
| AC-38 | Unit | 9 | pass | `tests/unit/secrets.test.ts` · pass @ phase-9 |
| AC-39 | E2E | 15 | pass | `tests/e2e/secrets-sniff.spec.ts` (phase-15 commit) |
| AC-40 | E2E | 13 | pass | `tests/e2e/layout.spec.ts` · pass @ phase-13 |
| AC-41 | E2E | 13 | pass | `tests/e2e/theme.spec.ts` · pass @ phase-13 (axe, both themes) |
| AC-42 | E2E | 11 | pass | `tests/e2e/leaderboard.spec.ts` · pass @ phase-11 |
| AC-43 | E2E | 2 | pass | `tests/e2e/turn-status.spec.ts` · pass @ phase-2 |
| AC-44 | E2E | 13 | pass | `tests/e2e/pwa.spec.ts` · pass @ phase-13 |
| AC-45 | Manual | 16 | Pending (human) | `docs/playtest.md` (H7, H8) |
| AC-46 | Unit | 9 | pass | `tests/unit/howto.test.ts` · pass @ phase-9 |
| AC-47 | E2E | 12 | pass | `tests/e2e/demo.spec.ts` · pass @ phase-12 · back-to-back regression added after the first CI run |
| AC-48 | Unit | 2 | pass | `tests/unit/results.test.ts` · pass @ phase-2 |
| AC-49 | Unit | 2 | pass | `tests/unit/rate-limit.test.ts` · pass @ phase-2 (tests/unit/engine-admin.test.ts) · E2E: a rejected demo start is shown (`tests/e2e/demo.spec.ts`) |
| AC-50 | E2E | 10 | pass | `tests/e2e/crews.spec.ts` · pass @ phase-10 |
| AC-51 | Unit | 10 | pass | `tests/unit/seasons.test.ts` · pass @ phase-10 |
| AC-52 | Unit | 10 | pass | `tests/unit/stats.test.ts` · pass @ phase-10 |
| AC-53 | Unit | 10 | pass | `tests/unit/awards.test.ts` · pass @ phase-10 |
| AC-54 | E2E | 10 | pass | `tests/e2e/recap.spec.ts` · pass @ phase-10 |
| AC-55 | E2E | 11 | pass | `tests/e2e/screen.spec.ts` · pass @ phase-11 |
| AC-56 | Unit | 4 | pass | `tests/unit/content/quiz.test.ts` · pass @ phase-4 (439 questions) |
| AC-57 | Unit | 4 | pass | `tests/unit/games/quiz.test.ts` · pass @ phase-4 |
| AC-58 | E2E | 4 | pass | `tests/e2e/quiz.spec.ts` · pass @ phase-4 |
| AC-59 | Unit | 4 | pass | `tests/unit/games/quiz-reports.test.ts` · pass @ phase-4 |
| AC-60 | Unit | 8 | pass | `tests/unit/content/movies.test.ts` · pass @ phase-8 (266 + 255 movies) |
| AC-61 | Unit | 8 | pass | `tests/unit/games/charades.test.ts` · pass @ phase-8 |
| AC-62 | E2E | 8 | pass | `tests/e2e/charades.spec.ts` · pass @ phase-8 |
| AC-63 | Unit | 5 | pass | `tests/unit/content/draw-words.test.ts` · pass @ phase-5 (592 words, 91 India) |
| AC-64 | Unit | 5 | pass | `tests/unit/strokes.test.ts` · pass @ phase-5 |
| AC-65 | Unit | 5 | pass | `tests/unit/games/draw.test.ts` · pass @ phase-5 |
| AC-66 | E2E | 5 | pass | `tests/e2e/draw.spec.ts` · pass @ phase-5 |
| AC-67 | Unit | 7 | pass | `tests/unit/content/places.test.ts` · pass @ phase-7 (9,766 places) |
| AC-68 | Unit | 7 | pass | `tests/unit/games/atlas.test.ts` · pass @ phase-7 |
| AC-69 | Unit | 7 | pass | `tests/unit/games/atlas-vote.test.ts` · pass @ phase-7 |
| AC-70 | E2E | 7 | pass | `tests/e2e/atlas.spec.ts` · pass @ phase-7 |
| AC-71 | Unit | 6 | pass | `tests/unit/content/imposter-pairs.test.ts` · pass @ phase-6 (186 pairs) |
| AC-72 | Unit | 6 | pass | `tests/unit/games/imposter.test.ts` · pass @ phase-6 |
| AC-73 | E2E | 6 | pass | `tests/e2e/imposter.spec.ts` · pass @ phase-6 |
| AC-74 | Unit | 9 | pass | `tests/unit/games/mlt.test.ts` · pass @ phase-9 (159 prompts) |
| AC-75 | E2E | 9 | pass | `tests/e2e/mlt.spec.ts` · pass @ phase-9 |
| AC-76 | Deploy | 16 | pass | GitHub Actions run #3 on 37dc613 green: checks, e2e android, e2e iphone (10 m 39 s) |
| AC-77 | Deploy | 16 | pass | `tests/deploy/realtime.spec.ts` · 2026-10-26 on https://playhuddle.vercel.app: action → other phone p50 847 ms, p95 860 ms over 50 actions (budget 1 s) |
| AC-78 | Deploy | 16 | pass | `tests/deploy/neon.spec.ts` · 2026-10-26 on https://playhuddle.vercel.app: room and seat restored in a new browser (first load 1991 ms); restart proven against Neon dev in phases 1 and 15; repeat across a redeploy after the next push |
| AC-79 | Deploy | 16 | pass | `tests/deploy/google.spec.ts` · 2026-10-26 on https://playhuddle.vercel.app: redirect to Google with callback /api/auth/callback/google, no error page |
| AC-80 | Deploy | 16 | fail | `tests/deploy/six-browsers.spec.ts` · 2026-10-26 on https://playhuddle.vercel.app: requests intermittently stalled 15–30 s (a phone could not answer, an answer or stroke batch never landed) in 6 of 9 runs; action p95 918–920 ms when not stalled. Fix in the post-15 commit (pg + `attachDatabasePool`, 10 s client timeouts); re-run after the next push |
| AC-81 | Deploy | 16 | pass | `scripts/probe-draw.ts` → `docs/deploy-checks.md` · 2026-10-26 on https://playhuddle.vercel.app: stroke delivery p50 325 ms, p95 413 ms, 2324/2324 delivered, 0 errors, 4.15 publishes/s, 1.33 % of the Ably quota per night |
| AC-82 | Manual | 16 | Pending (human) | `docs/playtest.md` (H8) |
| AC-83 | Unit | 13 | pass | `tests/unit/design-tokens.test.ts` · pass @ phase-13 |
| AC-84 | E2E | 13 | pass | `tests/e2e/design.spec.ts` · pass @ phase-13 |
| AC-85 | E2E | 13 | pass | `tests/e2e/celebrations.spec.ts` · pass @ phase-13 |
| AC-86 | E2E | 14 | pass | `tests/e2e/privacy.spec.ts` · pass @ phase-14 |
| AC-87 | Deploy | 16 | pass | `tests/deploy/demo.spec.ts` · 2026-10-26 on https://playhuddle.vercel.app: Quiz against 4 bots finished in 89 s |
| AC-88 | E2E | 5 | pass | `tests/e2e/draw-touch.spec.ts` · pass @ phase-5 |
| AC-89 | E2E | 16 | pass | `tests/e2e/account.spec.ts` (post-15 commit) |

---

## Decision log

Format: date · phase · decision · reason.

- 2026-10-22 · plan · Tests and E2E use a throwaway local Postgres (`embedded-postgres`, verified working on this machine); CI uses a Postgres service. · Neon is in US East, so local round-trips from India would make tests slow; Neon `dev` is kept for the real-services checks.
- 2026-10-22 · plan · Engine features are tested with an internal `ping` game that exists only in test mode. · Proves the engine before any real game exists.
- 2026-10-22 · 1 · All tables are created in `001_core.sql` instead of one migration per phase. · Fewer moving parts; later migrations only alter.
- 2026-10-22 · 1 · E2E and `test:real` share one production build made with sentinel secrets (`scripts/build.ts`). · Server secrets are read at runtime, so the secret-leak scan (AC-6) checks a real bundle.
- 2026-10-22 · 1 · Seats remember the active device (`deviceId`). Opening a room where you have a seat makes that device active, and the other device shows "seat moved". · Implements AC-3's seat-moved notice and gives signed-in players a clean device hand-over.
- 2026-10-22 · 1 · Until Draw & Guess exists, the room admin may post lobby strokes (`turnId: lobby`). The probe uses this. · Lets Phase 1 measure real stroke throughput.
- 2026-10-22 · 1 · The lobby "Wave" button is the skeleton action. · A harmless, fun action that exercises the full pipeline.
- 2026-10-22 · 1 · Deploy-check latency budget is 1 s on production, 6 s on the local real-services build. · Locally, every DB round trip goes India → Neon US East; Vercel `iad1` is next to Neon.
- 2026-10-23 · 2 · Catch-up runs each overdue deadline at its own due time (a virtual clock), so several overdue turns chain exactly. · Matches SPEC §4.3: AFK turns are skipped even while phones are off.
- 2026-10-23 · 2 · Test mode shortens the presence window (4 s), admin grace (5 s) and break (4 s), with a faster heartbeat. · Lets the hand-off, reclaim and AFK E2E tests run in seconds; production keeps 60 s / 60 s / 30 s.
- 2026-10-23 · 2 · Team balancing (snake draft plus swaps) is written in Phase 2; Phase 3 feeds it real ratings. · Charades and team Quiz need teams before ratings exist.
- 2026-10-23 · 4 · The quiz source is a compact pipe-delimited file (`content/src/quiz.txt`). `npm run build:content` turns it into `content/quiz.json`, placing the correct option deterministically, and a unit test proves the JSON matches the source. · Easy to review and edit, with no answer-position bias.
- 2026-10-23 · 4 · AC-3 also checks that a Quiz score carries over to the other device (it was seat-only in Phase 1). · Completes AC-3 as written.
- 2026-10-23 · 4 · The browser `offline` event shows "Reconnecting…" immediately and starts polling. On `online` the client resyncs and clears the pill if realtime survived. · Phones react to Wi-Fi drops without waiting 10 s.
- 2026-10-23 · 5 · Hint letters are timed events inside the drawing phase. `phase.deadline` is the next wake-up and `phase.endsAt` is the visible countdown; pause/resume shifts both through a module `shiftTimes` hook. · Hints work without a background loop and the countdown never jumps.
- 2026-10-23 · 5 · The canvas fingerprint (`data-op-digest`) uses canonical field order. · Postgres `jsonb` reorders object keys, so raw JSON differs between live and replayed ops.
- 2026-10-23 · 5 · Test mode shortens the Draw choose timer (4 s) and turn-end reveal (2.5 s) and lengthens the Quiz reveal (8 s); production keeps 15 s / 4 s / 5 s. · Fast E2E for AFK chains, plus robust reveal assertions on loaded iPhone emulation.
- 2026-10-23 · 5 · The demo bots' drawings are generated from simple parametric shapes (`scripts/make-bot-drawings.ts`, 24 words). · Deterministic, reviewable bot art.
- 2026-10-23 · 6 · An Imposter game has 1–5 rounds (default 3) with new words and a new imposter each round. With two imposters, the crew wins only if the accused is an imposter and their steal guess fails. The +50 good-vote bonus applies whatever the outcome. · SPEC defines a single round; repeated rounds make a fuller game. These details were left open.
- 2026-10-23 · 6 · E2E specs read final scores from the finished game in the snapshot instead of the scoreboard DOM, and check reveals on all phones in parallel. Local Playwright workers: 3. · The scoreboard break and reveals are short, and loaded WebKit pages are slow; the tests stay strict about values but not about wall-clock luck.
- 2026-10-23 · 7 · India's 28 states and 8 UTs, their capitals and well-known old names (Bombay, Calcutta, Madras, Orissa, Pondicherry…) come from a curated list in `scripts/build-places.ts`; countries, capitals and cities come from GeoNames. · The GeoNames admin1 data lags recent reorganisations; curated aliases go first so the 12-alternate cap never drops them.
- 2026-10-23 · 7 · A small `/about` page with the GeoNames attribution was added in Phase 7, not Phase 14. · AC-67 needs it, and it is a one-file page.
- 2026-10-23 · 7 · E2E scoreboard break raised to 8 s in test mode. · Fewer timing races on loaded iPhone emulation; production stays 30 s.
- 2026-10-23 · 8 · Rematch from a scoreboard break replays the game just played; from the night summary it replays the whole queue, with the same players and teams either way. · R31 allows either; AC-34 expects Charades to be replayed after Quiz → Charades.
- 2026-10-23 · 8 · The Charades actor also sees the year, industry, era and word count. · The word count is the classic first gesture.
- 2026-10-23 · 9 · Most Likely To results are recorded with `excludeFromSeason` and zero placement points (decision Q6). A player's own phone is told only *whether* it voted, never whom; the choice is remembered on that phone. · R89 says the app never sends or keeps who voted for whom.
- 2026-10-23 · 9 · The cross-game suites drive every game to the end with bots (`tests/helpers/drive.ts`), checking secrets, view size and rejoin stability at every step. · One driver covers every phase of every game.
- 2026-10-23 · 9 · Fixed: an Atlas bot's "blank this turn" decision is now made once per turn instead of re-rolled every tick. · The re-roll meant bots never ran out of time, so all-bot Atlas games never ended.
- 2026-10-23 · 10 · Fastest Finger across several quizzes in one night uses the correct-answer-weighted mean of each game's median time. The Most AFK tie-break counts missed turns per game. · Only per-game numbers are stored; with one quiz per night this equals the true median.
- 2026-10-23 · 10 · Crew stats count a claimed guest's games as the claiming user's (canonical identity = `merged_into` or self), and only crew members appear on the leaderboard. · Supports R3 and R49 together.
- 2026-10-23 · 10 · The recap card is drawn from the stored night summary with `next/og`, without emoji glyphs. · Works after the room has expired, and needs no external emoji CDN.
- 2026-10-23 · 11 · Big screens register through an httpOnly cookie scoped to "roomId.token" (max 2 per room). Screen requests carry `x-huddle-screen: 1`, so a laptop that is also a player's browser still shows only the public view. The screen reuses each game's phone component in a display layout. · One game UI per game; the screen never gets a private view.
- 2026-10-23 · 11 · The leaderboard overlay is a non-modal panel above the game, which stays mounted underneath and keeps typed input. It closes when the player's `mustAct` turns on. · R38 without pausing or interrupting the game.
- 2026-10-23 · 12 · The demo picker sends only a game id (`demoStart`); the server applies preset short rules, shortened further in test mode. Demo bots are seat-only identities (`bot:<uuid>`) with no database rows. · One tap per game for the evaluator, with deterministic, fast E2E coverage.
- 2026-10-23 · 12 · `npm run ci` now takes about 10 minutes locally (both device projects, including the all-games demo test). · Accepted; CI runs two workers with one retry.
- 2026-10-23 · 13 · `src/lib/design-tokens.ts` is the single source of colour values (a unit test checks contrast and that `globals.css` matches). Each game also has a text-safe `--accent-ink`. · Draw's sunny yellow is unreadable as text, so accent-coloured text now uses the ink variant.
- 2026-10-23 · 13 · Faded quiz options use a solid muted surface instead of opacity; the "You won!" card no longer combines `.card` with an accent background. · axe found the opacity version and an unlayered-CSS override that broke contrast.
- 2026-10-23 · 13 · Realtime counts as down until it actually connects. Test mode has a `huddle-test-no-realtime` hook. · WebKit can't intercept EventSource in Playwright, and a stream stuck "connecting" must still fall back to polling (R16).
- 2026-10-23 · 13 · One avatar colour changed (indigo → light pink). · The CIEDE2000 check found indigo too close to violet (ΔE 10.5).
- 2026-10-23 · 13 · The offline page uses a plain `<a href="/">` (lint exception). · Offline, a full reload is the right "try again".
- 2026-10-23 · 15 · Rooms with more than 4 phones give every further phone its own Playwright browser. · Playwright's WebKit shares one network process (6 connections per host) across contexts, and each phone holds an open event stream in test mode, so phones 7 and 8 never loaded. Real phones are separate devices; production uses Ably WebSockets.
- 2026-10-23 · 15 · The sniffing test (AC-39) treats a capture as "before the reveal" when it arrived before the reveal showed and is not itself a `reveal`/`turnEnd` state. The test-mode log stamps each frame with its arrival time. · A loaded iPhone emulator can paint a frame seconds after it arrives, so a wall-clock margin flagged the reveal frames themselves.
- 2026-10-23 · 15 · Snapshot, tick and heartbeat first run catch-up on an unlocked read (`peekRoom`) and take the row lock only when something is due or the room needs its expiry extended. · The six-browser run against Neon showed every request in a room queueing on the row lock (~0.9 s each from India), so private views arrived 14 s late and answers missed the question timer.
- 2026-10-23 · 15 · Phones schedule ticks on `safeNow()`, a lower bound on server time (`serverNow − tRecv`), and back off 1–2 s after a no-op tick. A snapshot that an update overtook is fetched again. The countdown still uses the midpoint estimate (AC-22). · `serverNow` is stamped as the response leaves, so slow responses made the midpoint estimate run ahead: phones ticked early and repeatedly, which fed the lock queue.
- 2026-10-23 · 15 · AC-80's test starts a 5-question quiz (production minimum), plays the 3 questions the AC asks for, and the admin ends it. Latency runs from the moment the tap is sent. · Production settings reject 3 questions; the old timer also counted waiting for the options to unlock.
- 2026-10-23 · after 15 · The first CI run failed AC-84 (and its retry): `visitEachGame` sends two admin actions per demo game, and on the CI runner the 11th action (the Most Likely To demo start) landed 918 ms after the 1st, so the server rejected it with `RATE_LIMITED` (R46, 10 actions per seat per second) and the room drifted to the night summary. The helper now tracks the page's action requests and waits until the 10th most recent one is over a second old, and the demo picker awaits its start and shows an error instead of dropping a rejected tap. Regression tests: six demo games started and ended back to back through the sync client (fails at the 11th action without pacing), and a rate-limited demo start that must be shown and then succeed. · The limit is correct product behaviour; the test was outrunning it, and the picker hid the rejection. Locally each game took ~250 ms, under the limit, which is why it never failed here.
- 2026-10-23 · after 15 · GitHub Actions runs a `checks` job (lint, typecheck, unit) and an `e2e` matrix (`android`, `iphone`, `fail-fast: false`, 2 workers each), each installing only its own browser and uploading its own report. · About half the wall-clock time of the single 20-minute job, and a failure names its device. Actions minutes are free for a public repo.
- 2026-10-24 · after 15 · The split iPhone job (e4865c7) was cancelled at the 40-minute limit with the solo demo test (600 s budget, an iteration-bounded `playAlong` with 15 s clicks) and the 8-phone full night (900 s, 800 s loops, hand-launched WebKit browsers) never reporting. Not reproduced on Linux WebKit here (12 cores, 4 cores, software GL: 9.3–9.5 min, 47/47). Fixes: phones beyond 4 use another loopback name (`127.0.0.1`, `[::1]`) instead of extra browsers, so every phone belongs to the test's own browser and is cleaned up even on failure; full night closes its phones in `finally`; the demo test uses the deadline-based `playUntil`; budgets match real durations (300 s and 420 s). CI: `globalTimeout` 25 min, a 30-minute step limit, trace and screenshot on every failure, video on the CI retry (`on-first-retry`: recording every page on every run made two WebKit tests flaky under full-suite load), the `github` reporter, and the report uploaded `if: always()`. · Budgets 3–4× the real duration plus a retry outlasted the job, so a stuck run was cancelled with no result and no report.
- 2026-10-24 · after 15 · Three latent E2E races surfaced while verifying: AC-55 scanned static JS bundles for the Draw word (a random "queue" matched bundle code), so it now scans documents and API responses only; AC-42's loop ended each game from the admin menu although an unplayed Draw ends itself, so it ends games through the sync client and accepts "already over"; AC-40 tapped ✕ on a leaderboard overlay that closes itself on the player's turn, so it now asserts the overlay is closed either way. · Each lost to a game timer only under full-suite load; the fixes wait for the state the test needs instead of racing the timer.
- 2026-10-26 · after 15 · Production checks (SPEC v0.4): requests on https://playhuddle.vercel.app intermittently stalled 15–30 s before the server did their work (a phone's private refresh, an answer and a stroke batch). The Vercel path reused a module-scope Neon WebSocket pool across invocations with no timeouts; Neon says that pool must not outlive a request, and Vercel says idle timeouts don't run while an instance is suspended. Production now uses `pg` over TCP with `attachDatabasePool`, a 5 s idle timeout, 10 connections and a 30 s limit on getting a connection (shorter connection limits and a 10 s statement timeout failed actions queued on the row lock in the slow `VERCEL=1 test:real` runs; a statement timeout cannot catch a query hung on a dead connection anyway); the client times out catch-up requests after 10 s and actions after 30 s (a 10 s action timeout dropped taps in the slow India → Neon `test:real` runs). Verified locally on the same code path (`VERCEL=1 test:real`); production proof needs the next push. · A stalled request blocked catch-ups and actions on one phone for a whole question.
- 2026-10-26 · after 15 · AC-80's stroke latency is measured from the end of each stroke to the last viewer matching, polling all viewers at once every 25 ms; the reloaded phone's catch-up is reported separately. · Sequential `expect.poll` with growing gaps measured the poller (1.6 s) while the probe measured delivery at p95 413 ms.
- 2026-10-26 · after 15 · R94 / AC-89: Sign in next to the theme toggle and in the Your crews card; while signed in, an account row under the header with an initial avatar, the name and Sign out (a server action calling Auth.js `signOut`). · The signed-in row does not fit beside the title and toggle at 360 px (AC-40).
- 2026-10-26 · after 15 · WebKit "button never stable": no infinite or repeating animation exists; `bump` and `pop-in` are one-shot transform/opacity animations that never move other elements, and reduced motion already cuts them to 1 ms. The failures' "not stable → detached" means the button was removed by a state change, so no animation change was made. · Checked as asked (POLISH task 3).

## Blockers

*(none)*

## Plan changelog

- **v1** (2026-10-22): first plan.
- **v2** (2026-10-22):
  - No Vercel CLI or builder deploys; Vercel is Git-connected and deploys on the owner's push.
  - Phases are verified on a local production build, with a real-services check (`test:real`).
  - The repo already exists (public).
  - No contact email; the privacy page links to GitHub Issues.
  - Every E2E spec runs on Android Chromium and on iPhone WebKit; added AC-88.
  - Human steps reordered: H1–H3 done; Vercel import and Google OAuth come after Phase 1.
  - Production ACs are `Pending (human)`.
