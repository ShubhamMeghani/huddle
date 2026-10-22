# Huddle: Build Plan (PLAN.md)

> **Spec:** [SPEC.md](SPEC.md) **v0.2** (commit `dd4c9f0`, 2026-10-22). It has 93 requirements and 87 acceptance criteria, and §11 lists the binding decisions.
> **Plan version:** 1 · 2026-10-22

## Stack

The full stack is in SPEC §3:

- Next.js App Router with TypeScript (strict), Tailwind CSS, Node.js 24 LTS.
- Neon Postgres: `@neondatabase/serverless` on Vercel, `pg` locally and in CI.
- Ably for realtime. Browsers get subscribe-only tokens; a local SSE driver replaces Ably in test mode.
- Auth.js v5 with optional Google sign-in.
- Vitest and Playwright.
- Vercel Hobby, with the region pinned to `iad1`, next to Neon in AWS US East 1.
- GitHub Actions on `ubuntu-24.04`.

## Test commands

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: unit tests, content checks, and API handlers against Postgres. Uses `TEST_DATABASE_URL` in CI, otherwise the Neon `dev` branch from `.env.local`, with one throwaway schema per run. |
| `npm test -- -t "AC-14\b"` | One Unit AC. Every AC test's name starts with its ID. |
| `npm run check:content` | Content-bank checks only (SPEC §4.8) |
| `npm run test:e2e` | Playwright `e2e` project. Builds the app and starts it in test mode (`HUDDLE_TEST_MODE=1`, `REALTIME_DRIVER=local`, seeded RNG, short timers). |
| `npm run test:e2e -- --grep "AC-16\b"` | One E2E AC |
| `npm run test:deploy -- --grep "AC-77\b"` | Playwright `deploy` project against production (`DEPLOY_URL`). `--grep @smoke` runs the quick post-deploy smoke test. |
| `npm run probe:draw` | Drawing-throughput probe against production. Appends its results to `docs/deploy-checks.md`. |
| `npm run db:migrate` | Applies `db/migrations` to the Neon `dev` branch (`node --env-file=.env.local …`). Production migrates during `vercel-build`. |
| `npm run env:check` | Prints each required variable **name** with `set` or `MISSING`, from `.env.local` and `npx vercel env ls`. Never prints values. |
| `npm run ci` | lint → typecheck → test → build → test:e2e. This is exactly what GitHub Actions runs. |
| `npx vercel deploy --prod` | Production deploy from the local tree |

## Rules for the autonomous build

1. **Order.** Do the phases in order, and the tasks within a phase in order. A phase is done only when every "Done when" AC passes with the listed proof command, `npm run ci` is green, and the production smoke test passes.
2. **One commit per phase.** Commit at the end of the phase using the git-commit skill conventions: `feat(phase-N): <summary>` with a `Refs:` line listing the R# and AC-# IDs. The commit includes this file's updated status tables.
   - Never push.
   - Never amend, rebase or force.
   - Never stage `.env*`, `.vercel/` or downloaded raw data. GeoNames dumps stay in a gitignored `.cache/`.
3. **Secrets.**
   - Never read, open, `cat`, grep, upload or print `.env.local` or any environment value.
   - Never log `process.env` values in code, tests or scripts.
   - Env is loaded only by `node --env-file`, Next.js, Vitest or Vercel. To check configuration, use `npm run env:check` (names only).
   - Never ask the user to paste a key into chat.
4. **When to stop.**
   - **Stop only if a SPEC requirement or AC must change**: it is impossible, contradictory or untestable as written. Then write a proposed change under [Blockers](#blockers) (ID, current text, proposed text, reason, impact). Do not edit SPEC.md and do not commit the unfinished phase. Stop and report.
   - Decide everything else yourself and keep going: library choices, internal design, bugs, flaky tests, content wording, layout. Log notable choices in the [Decision log](#decision-log).
   - There is one exception, which can only happen before Phase 1 task 1.3: if `env:check` shows `MISSING`, report the missing names and stop.
5. **Tests are the referee.** Never delete, skip, `.only`, loosen or re-time a test just to get green. A flaky test gets fixed, not retried; the only retry is Playwright `retries: 1` in CI.
6. **Deploy every phase.** After the phase gate, run `npx vercel deploy --prod`, then `npm run test:deploy -- --grep @smoke`. The production database changes only through forward-only, idempotent migrations. Never run ad-hoc SQL against Neon `main`.
7. **Human steps.** Only the [HUMAN] tasks below need the user: Phase 1 H1–H6 and Phase 16 H7–H8. Everything else is [AUTO] and runs unattended.
8. **Bookkeeping.** At the end of each phase, set every AC proven in it to `pass` in the [AC table](#acceptance-criteria-status), with evidence (test file and commit hash). Update the [phase board](#phase-board) too.

## Phase board

| Phase | Name | Mode | Target | Status | Commit |
|---|---|---|---|---|---|
| 1 | Deployment skeleton | HUMAN, then AUTO | Day 1 | todo | – |
| 2 | Core engine: rooms, sync, rejoin, timers, AFK, admin, queue | AUTO | Day 1 | todo | – |
| 3 | Teams and ratings | AUTO | Day 1 | todo | – |
| 4 | Quiz Clash | AUTO | Day 1 | todo | – |
| 5 | Draw & Guess | AUTO | Day 2 | todo | – |
| 6 | Imposter | AUTO | Day 2 | todo | – |
| 7 | Atlas | AUTO | Day 2 | todo | – |
| 8 | Dumb Charades | AUTO | Day 2 | todo | – |
| 9 | Most Likely To (Should) and cross-game suites | AUTO | Day 2 | todo | – |
| 10 | Crews, rankings, awards, recap card | AUTO | Day 3 | todo | – |
| 11 | Leaderboard button and big screen | AUTO | Day 3 | todo | – |
| 12 | Demo with bots | AUTO | Day 3 | todo | – |
| 13 | Design and PWA | AUTO | Day 3 | todo | – |
| 14 | Privacy page | AUTO | Day 3 | todo | – |
| 15 | Full multi-player E2E suite and production verification | AUTO | Day 3 | todo | – |
| 16 | Human acceptance: install and playtest | HUMAN, then AUTO | after Day 3 | todo | – |

If time runs short, cut Should items in this order (SPEC §10): recap card (10.7) → big screen (11.2) → Most Likely To (Phase 9, tasks 9.1–9.2). Log every cut in the Decision log, and mark the affected ACs `cut`. The steal rule (R65) is a Must, so cutting it would be a SPEC change (rule 4).

---

## Phase 1: Deployment skeleton

**Goal:** prove every risky piece on production (SPEC §7, P1-1 to P1-5) before any game is built.

### Your steps: do these first, about 30 minutes in total

Do them in this order: **H1 → H2 → H3 → H4 → H5**. H6 can happen any time; the first push is after the Phase 1 commit. Never paste a key, connection string or secret into chat. Values go only into `.env.local` (which you edit yourself) and the Vercel dashboard.

#### H1 [HUMAN] Vercel project and CLI link (about 3 min)

1. In a terminal at `C:\projects\huddle`, run `npx vercel login` and finish the login in the browser.
2. Run `npx vercel link` and answer:
   - Set up? **Yes**
   - Scope: your personal account
   - Link to an existing project? **No**
   - Project name: `huddle`
   - Directory: `./`
   - Modify settings? **No**
3. On vercel.com, open project `huddle` → **Settings → Domains → Add**. Enter a free `huddle-<something-unique>.vercel.app` name and attach it to **Production**. This name is **`<prod-domain>`** in H4 and H5.
4. **Settings → Git:** do **not** connect a repository. Claude deploys with the CLI, and you control GitHub pushes.

#### H2 [HUMAN] Neon (about 5 min)

1. Go to console.neon.tech → **New project**:
   - Name: `huddle`
   - Postgres version: the default
   - Cloud provider: **AWS**
   - Region: **AWS US East 1 (N. Virginia)**
   - Click **Create**.
2. The default branch `main` is production. Go to **Branches → New branch**: name `dev`, parent `main`, then **Create**.
3. Click **Connect**. Choose branch `main`, database `neondb`, role `neondb_owner`, and turn **Connection pooling ON**. Copy the string; its host contains `-pooler` and it ends with `sslmode=require`. This is **MAIN_POOLED**.
4. Do the same with branch `dev`. This is **DEV_POOLED**.
5. Skip the Neon–Vercel integration. It would create its own branches and env vars.

#### H3 [HUMAN] Ably (about 4 min)

1. Go to ably.com → **Sign up** (Free plan) and verify your email.
2. **Create new app** named `huddle`. Any use-case or SDK answer is fine.
3. In the app, go to **API Keys → Create new API key**. Name it `huddle-server` and set:
   - **Publish:** on. The server publishes `state` and `strokes` messages.
   - **Subscribe:** on. The server signs subscribe-only tokens for browsers, and a key can only grant what it holds.
   - **Statistics:** on. Used only by the Phase 1 probe to read message counts.
   - Everything else **off**: History, Presence, Channel metadata, Push subscribe, Push admin, Privileged headers, and any Object/LiveObjects options.
   - Resource restrictions: none. Then **Save**.
4. Don't use the default **Root** key. Copy the `huddle-server` key, which looks like `xxxx.yyyy:zzzz`. This is **ABLY_KEY**.

#### H4 [HUMAN] Google OAuth client (about 10 min; needs `<prod-domain>` from H1)

1. Go to console.cloud.google.com → project picker → **New project**. Name it `huddle-auth`, click **Create**, then select it.
2. Go to **Google Auth Platform** (APIs & Services → OAuth consent screen) → **Get started**:
   - App name `Huddle`
   - User support email: yours
   - Audience: **External**
   - Contact email: yours
   - Agree, then **Create**.
3. **Branding:**
   - App home page: `https://<prod-domain>`
   - Privacy policy: `https://<prod-domain>/privacy`
   - Authorized domains: add `<prod-domain>`
   - Leave the logo and terms empty. A logo triggers brand verification.
   - Click **Save**.
4. **Data access → Add or remove scopes:** select `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`, then **Update → Save**. These are non-sensitive scopes, so no verification is needed.
5. **Clients → Create client:**
   - Type: **Web application**
   - Name: `Huddle web`
   - Authorized JavaScript origins: `http://localhost:3000` and `https://<prod-domain>`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<prod-domain>/api/auth/callback/google`
   - Click **Create**, then copy the **Client ID** (**GOOGLE_ID**) and **Client secret** (**GOOGLE_SECRET**).
6. Go to **Audience → Publish app → Confirm**; the status becomes "In production".
   - If Google won't publish because `/privacy` isn't live yet, add your own Google account under **Test users** for now. Click **Publish app** after Claude reports that the Phase 1 deploy is live (task 1.12).
   - Preview deployments use random URLs, so sign-in stays off there by design.

#### H5 [HUMAN] Put secrets in the environments (about 5 min)

1. Generate three random `AUTH_SECRET` values by running `openssl rand -base64 32` in Git Bash three times: one each for local, Preview and Production.
2. **Locally:** create `C:\projects\huddle\.env.local`, or copy `.env.example` once Claude has created it, and fill in the **Local** column yourself.
3. **Vercel:** go to project → **Settings → Environment Variables**, add each name for the environments shown, and tick **Sensitive** where offered.

| Variable | Production | Preview | Local `.env.local` |
|---|---|---|---|
| `DATABASE_URL` | MAIN_POOLED | DEV_POOLED | DEV_POOLED |
| `ABLY_API_KEY` | ABLY_KEY | ABLY_KEY | ABLY_KEY |
| `AUTH_SECRET` | random value #1 | random value #2 | random value #3 |
| `AUTH_GOOGLE_ID` | GOOGLE_ID | *(leave unset)* | GOOGLE_ID |
| `AUTH_GOOGLE_SECRET` | GOOGLE_SECRET | *(leave unset)* | GOOGLE_SECRET |
| `NEXT_PUBLIC_CONTACT_EMAIL` | the contact address shown on `/privacy` | same | same |

Never set `HUDDLE_TEST_MODE`, `REALTIME_DRIVER`, `TEST_DATABASE_URL` or `DEPLOY_URL` in Vercel. Test mode refuses to run on Vercel. Don't add Vercel "Development" variables either, because local runs use `.env.local`.

4. Tell Claude **"env done"**. Claude checks the names only, with `npm run env:check`.

#### H6 [HUMAN] GitHub remote for CI (about 3 min; first push after the Phase 1 commit)

1. On github.com, create a **New repository** named `huddle`. Make it private and add no README, .gitignore or license.
2. Run `git remote add origin https://github.com/<you>/huddle.git`.
3. Run `git push -u origin main` after the Phase 1 commit, and again whenever you like. Claude never pushes. Each push runs CI, which is the evidence for AC-76.

### Claude's tasks

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 1.1 | **Scaffold:**<br>• Next.js (App Router, TS strict), Tailwind, ESLint, Vitest, Playwright (`e2e` and `deploy` projects)<br>• The npm scripts listed above<br>• `.env.example` (names only)<br>• `vercel.json` (`framework: nextjs`, `regions: ["iad1"]`, build runs migrations then `next build`)<br>• `engines.node: 24.x`<br>• A README skeleton<br>• Light-default theme tokens with a dark toggle stub | AUTO | R36, R90 | `npm run lint && npm run typecheck && npm run build` |
| 1.2 | **`env:check` script**, names only, covering `.env.local` and `vercel env ls` | AUTO | – | `npm run env:check` lists every name; no values are printed |
| 1.3 | **Gate:** every variable `set`. Otherwise report and stop (rule 4 exception). | AUTO | – | `npm run env:check` |
| 1.4 | **CI workflow** `.github/workflows/ci.yml`: ubuntu-24.04, Node 24, a Postgres 16 service, Playwright browsers, sentinel secret values, runs `npm run ci` | AUTO | R90 | `npm run ci` green locally; AC-76 after the H6 push |
| 1.5 | **Database:**<br>• `src/server/db.ts` (Neon serverless on Vercel, `pg` elsewhere)<br>• A migration runner using transaction-scoped locks<br>• `001_core.sql`: identities, users, rooms, room_actions, presence, strokes<br>• A per-run test schema helper<br>• `npm run db:migrate` on `dev` | AUTO | R11 | `npm test -- -t "migrations"` (idempotent re-run) |
| 1.6 | **Test mode:**<br>• A guard that refuses to start when `VERCEL_ENV` is set<br>• Seeded RNG header and short timers<br>• Realtime drop-message hook<br>• Test Credentials provider<br>• `REALTIME_DRIVER=local` SSE driver | AUTO | R4 | AC-6 |
| 1.7 | **Guest identity:** name validation, `huddle_dt` cookie, `POST /api/identity/guest` | AUTO | R1 | AC-1, AC-2 |
| 1.8 | **Ably driver:**<br>• Server publish via REST<br>• `GET /api/realtime/token` returning a subscribe-only TokenRequest with 60 min TTL and `authUrl` renewal<br>• The same interface as the local driver | AUTO | R4 | AC-5 |
| 1.9 | **Auth.js v5:**<br>• Google provider, only when `AUTH_GOOGLE_ID` is set<br>• JWT sessions and `users` upsert<br>• Test provider in test mode | AUTO | R2 | AC-3 |
| 1.10 | **Skeleton room:**<br>• Create with code, link and QR; join<br>• A "+1 counter" action through the full pipeline: lock, version, idempotent `actionId`, publish after commit<br>• Snapshot, gap → snapshot, reload restore<br>• A minimal `/privacy` page, finalised in Phase 14<br>• `@smoke` deploy test | AUTO | R5, R6, R11–R15, R93 | `npm run test:e2e -- --grep @skeleton` |
| 1.11 | **Strokes endpoint and throughput probe:**<br>• `POST/GET strokes` (idempotent `seq`, 8 KB cap, 8 batches/s cap)<br>• `scripts/probe-draw.ts` replays a recorded 80 s drawing to production with 6 viewer subscribers and 1 screen subscriber. It records publishes/s, the largest message, Ably errors and Ably app stats.<br>• Fetch the **current Ably Free limits** from Ably's pricing and limits docs and record them, with URL and date, in `docs/deploy-checks.md` | AUTO | R70 | AC-81 (probe form) |
| 1.12 | **First production deploy** with `npx vercel deploy --prod`; `vercel-build` migrates Neon `main` | AUTO | R8 | `npm run test:deploy -- --grep @smoke` |
| 1.13 | **Deploy checks on production:**<br>• Ably token auth and update latency → AC-77<br>• Neon survives a redeploy, and the first request after 10 min idle is under 5 s → AC-78<br>• Google redirect check → AC-79<br>• **6 real browsers** (2 Chromium, 2 Firefox, 2 WebKit) in one skeleton room: 30 counter actions, one reload mid-run, identical final state, p95 ≤ 1 s → `tests/deploy/six-browsers.spec.ts @skeleton`<br>• All results logged in `docs/deploy-checks.md` | AUTO | R2, R4, R8, R11, R15 | AC-77, AC-78, AC-79 |

**Done when:** AC-1, AC-2, AC-3, AC-5, AC-6, AC-77, AC-78, AC-79, the AC-81 probe form, and the six-browser skeleton check.
**Proof:**
- `npm test -- -t "AC-(1|5)\b"`
- `npm run test:e2e -- --grep "AC-(2|3|6)\b|@skeleton"`
- `npm run test:deploy -- --grep "AC-(77|78|79)\b|@skeleton"`
- `npm run probe:draw`
- `npm run ci`

**Commit:** `feat(phase-1): deployment skeleton with CI, Neon, Ably, auth and probe`

---

Everything from here on is **[AUTO]** and runs unattended until Phase 16. Each phase ends with:

1. `npm run ci`
2. `npx vercel deploy --prod`
3. `npm run test:deploy -- --grep @smoke`
4. Updating the AC table and the phase board
5. One commit

## Phase 2: Core engine (rooms, seats, sync, rejoin, timers, AFK, admin, queue)

Engine behaviour is tested with an internal **`ping` test game** that has both turn-based and simultaneous modes and exists only in test mode. ACs that name a specific game finish in that game's phase.

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 2.1 | **Room state and pipeline:**<br>• Room state document and the game-module interface (`init/apply/onDeadline/view/botAct`)<br>• `ping` game<br>• Full action pipeline: catch-up, error codes, notices | AUTO | R11, R12 | AC-13 and AC-14 (engine part) |
| 2.2 | **Rooms:**<br>• Code alphabet with collision retry; QR; join by link or code; not-found page<br>• 12-seat cap; spectators (cap 8) and screens (cap 2) per Q8<br>• Seating late joiners at the next round<br>• Kick and `KICKED`<br>• Expiry: lazy on access, plus a daily Vercel cron that deletes strokes and presence for expired rooms | AUTO | R5–R10 | AC-7, AC-8, AC-9, AC-10, AC-12 |
| 2.3 | **Views and client sync:**<br>• Per-viewer `view()`, snapshot route and `privateFor`<br>• Client sync store: version gaps, reconnect/visible/focus/online, 25 s heartbeat, 3 s polling fallback, "Reconnecting…" pill | AUTO | R13, R14, R16, R35 | AC-16, AC-15 (engine part) |
| 2.4 | **Rejoin and seat reclaim:** restore by token or profile; the "That's me" approval flow | AUTO | R15, R17 | AC-21, AC-18 (`ping` part) |
| 2.5 | **Timers:**<br>• Server deadlines and the clock-offset estimator<br>• Countdown component<br>• Tick route with jitter; catch-up capped at 50 steps<br>• Auto-pause after 120 s of silence<br>• Pause and resume | AUTO | R18–R20, R23 | AC-22, AC-23, AC-24, AC-25, AC-28 |
| 2.6 | **AFK:** missed-turn count, AFK at 2, immediate skips, badge, "I'm back" | AUTO | R21, R22 | `ping` unit tests (AC-26 finishes in Phase 5, AC-27 in Phase 7) |
| 2.7 | **Admin:**<br>• Skip, kick, pause/resume, end game, transfer, notices<br>• Undo of score events<br>• Auto hand-off after 60 s away or AFK<br>• Settings lock | AUTO | R24–R27 | AC-29, AC-30, AC-31, AC-32 (engine part) |
| 2.8 | **Queue and night:**<br>• House-rules schema framework and queue builder<br>• 30 s scoreboard break; End night; rematch<br>• Results recording in `002_results.sql` (games, game_results, nights) | AUTO | R28–R31, R45 | AC-48 |
| 2.9 | **Rate limits:** 10 actions/s and 3 chat messages per 2 s | AUTO | R46 | AC-49 |
| 2.10 | **App shell:**<br>• Home and lobby<br>• Turn status bar ("Your turn" / "Waiting for <name>")<br>• Vibration hook, with no audio anywhere<br>• How-to-play sheet component<br>• 360 px layout on light-default tokens | AUTO | R37, R39, R40, R42 | AC-43 |

**Done when:** AC-7, AC-8, AC-9, AC-10, AC-12, AC-16, AC-21, AC-22, AC-23, AC-24, AC-25, AC-28, AC-29, AC-30, AC-31, AC-43, AC-48, AC-49.
**Proof:**
- `npm test -- -t "AC-(7|10|22|24|25|28|30|48|49)\b"`
- `npm run test:e2e -- --grep "AC-(8|9|12|16|21|23|29|31|43)\b"`
- `npm run ci`

**Commit:** `feat(phase-2): core room engine with sync, rejoin, timers, AFK, admin and queue`

## Phase 3: Teams and ratings

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 3.1 | **Ratings:** `003_ratings.sql`; multiplayer Elo (K = 32) applied once per completed game | AUTO | R33 | AC-37 |
| 3.2 | **Balancing:** snake draft plus improving swaps, with strength fallbacks (game rating → mean of other ratings → 1000) | AUTO | R32 | AC-35 |
| 3.3 | **Lobby team UI:** propose, move, shuffle, rebalance. Late joiners go to the smallest team. | AUTO | R32, R9 | AC-36 |

**Done when:** AC-35, AC-36, AC-37.
**Proof:**
- `npm test -- -t "AC-(35|37)\b"`
- `npm run test:e2e -- --grep "AC-36\b"`
- `npm run ci`

**Commit:** `feat(phase-3): auto-balanced teams and multiplayer Elo ratings`

## Phase 4: Quiz Clash

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 4.1 | **Content:** write `content/quiz.json`: ≥ 400 original questions, ≥ 40 per category, with difficulties and no time-relative wording. Add the quiz rules to `check:content`. | AUTO | R56 | AC-56 |
| 4.2 | **Rules module:** flow, single lock-in (Q7), early end, scoring, team averages, no repeats, AFK exclusion | AUTO | R57–R59, R61 | AC-57 |
| 4.3 | **Report question:** `004_reports.sql`, exclusion at 3 reports, `scripts/export-reports.ts` (Q11) | AUTO | R60 | AC-59 |
| 4.4 | **View, bot and UI:**<br>• View: answer hidden until reveal<br>• `bot.ts` and How-to-play content<br>• UI: question, options, lock-in, reveal with distribution, report button | AUTO | R34, R42, R44 | AC-38 (Quiz fixtures) |
| 4.5 | **E2E:** quiz flow, late joiner, offline/reconnect, polling-only client | AUTO | R9, R15, R16, R57, R58 | AC-58, AC-11, AC-19, AC-20 |

**Done when:** AC-11, AC-19, AC-20, AC-56, AC-57, AC-58, AC-59.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(56|57|59)\b"`
- `npm run test:e2e -- --grep "AC-(11|19|20|58)\b"`
- `npm run ci`

**Commit:** `feat(phase-4): Quiz Clash with 400+ question bank`

## Phase 5: Draw & Guess

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 5.1 | **Content:** write `content/draw-words.json`: ≥ 500 words, ≥ 75 tagged `india`. Add checks. | AUTO | R67 | AC-63 |
| 5.2 | **Strokes:** stroke codec, RDP (ε 0.75), client batching (200 ms / 64 points) | AUTO | R70 | AC-64 |
| 5.3 | **Rules:**<br>• 3 choices; a 15 s choice timeout counts as a missed turn<br>• Mask and hints<br>• Guess normalisation and close guesses<br>• Scoring and chat visibility<br>• Early end and rounds | AUTO | R68, R71–R75 | AC-65 |
| 5.4 | **Canvas UI:** 12 colours, 4 sizes, eraser, undo, clear; replay and catch-up via the strokes API | AUTO | R69, R70 | AC-66 (part) |
| 5.5 | **Bot:** `bot.ts`, plus `content/bot-drawings.json` (≥ 20) generated by `scripts/make-bot-drawings.ts`. Add How-to-play content. | AUTO | R42, R44 | unit test: bot draws a valid op stream |
| 5.6 | **E2E:** live drawing and guessing, rejoin mid-turn, AFK drawer, hostless Quiz → Draw queue | AUTO | R15, R21, R22, R28, R30 | AC-66, AC-17, AC-26, AC-33 |

**Done when:** AC-17, AC-26, AC-33, AC-63, AC-64, AC-65, AC-66.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(63|64|65)\b"`
- `npm run test:e2e -- --grep "AC-(17|26|33|66)\b"`
- `npm run ci`

**Commit:** `feat(phase-5): Draw & Guess with live strokes, hints and 500+ words`

## Phase 6: Imposter

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 6.1 | **Content:** write `content/imposter-pairs.json`: ≥ 150 India-aware pairs with 2 hints per word. Add checks. | AUTO | R82 | AC-71 |
| 6.2 | **Rules:**<br>• Imposter selection and private words<br>• "Imposter knows" toggle, off by default (Q2)<br>• Clue rounds and validation<br>• Discussion with Ready; vote; tie revote<br>• Steal guess and scoring | AUTO | R83–R87 | AC-72 |
| 6.3 | **UI and bot:** word card, clue list, vote and reveal screens; `bot.ts`; How-to-play content | AUTO | R42, R44 | AC-38 (Imposter fixtures) |
| 6.4 | **E2E:** 5-player seeded round | AUTO | R83–R87 | AC-73 |

**Done when:** AC-71, AC-72, AC-73.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(71|72)\b"`
- `npm run test:e2e -- --grep "AC-73\b"`
- `npm run ci`

**Commit:** `feat(phase-6): Imposter with 150+ word pairs`

## Phase 7: Atlas

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 7.1 | **Place data:** `scripts/build-places.ts` downloads GeoNames dumps into the gitignored `.cache/geonames/`, filters per Q5 and writes a deterministic `data/places.json` (server-only) with the attribution string | AUTO | R76 | AC-67 |
| 7.2 | **Validation:** normalisation, alternate names, used-by-place tracking, variants, last-letter fallback | AUTO | R77, R78, R81 | AC-68 |
| 7.3 | **Accept vote** (pauses the timer), lives, elimination, scoring, `place_suggestions` | AUTO | R79, R80 | AC-69 |
| 7.4 | **UI, bot and E2E:**<br>• UI, `bot.ts`, How-to-play content<br>• E2E game<br>• AFK across Quiz, Draw and Atlas<br>• The Atlas clause of the concurrency test | AUTO | R12, R21, R42, R44 | AC-70, AC-27, AC-14 |

**Done when:** AC-14, AC-27, AC-67, AC-68, AC-69, AC-70.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(14|27|67|68|69)\b"`
- `npm run test:e2e -- --grep "AC-70\b"`
- `npm run ci`

**Commit:** `feat(phase-7): Atlas with GeoNames place database and accept vote`

## Phase 8: Dumb Charades

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 8.1 | **Content:** write `content/movies.json`: ≥ 200 Bollywood and ≥ 200 Hollywood titles with year, era and difficulty. Add checks. | AUTO | R62 | AC-60 |
| 8.2 | **Rules:** actor rotation, title only to the actor, Guessed / Pass / timeout, steal window, rounds | AUTO | R63–R66 | AC-61 |
| 8.3 | **UI, bot and E2E:**<br>• Actor card, team timer and Guessed/Pass buttons<br>• `bot.ts` and How-to-play content<br>• E2E game, and the queue/rematch test (Quiz → Charades) | AUTO | R29–R31, R42, R44 | AC-62, AC-34 |

**Done when:** AC-34, AC-60, AC-61, AC-62.
**Proof:**
- `npm run check:content`
- `npm test -- -t "AC-(60|61)\b"`
- `npm run test:e2e -- --grep "AC-(34|62)\b"`
- `npm run ci`

**Commit:** `feat(phase-8): Dumb Charades with 400+ movies`

## Phase 9: Most Likely To (Should) and cross-game suites

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 9.1 | **Game:** write `content/mlt-prompts.json` (≥ 150). Rules with an anonymous tally: individual votes are dropped once totals are computed. Night stats only (Q6). | AUTO | R88, R89 | AC-74 |
| 9.2 | **UI, bot and E2E:** dramatic reveal UI, `bot.ts`, How-to-play content, E2E | AUTO | R88, R89, R44 | AC-75 |
| 9.3 | **Cross-game suites**, now that all six games exist:<br>• invalid-action tables (AC-13)<br>• public-view size (AC-15)<br>• rejoin regression (AC-18)<br>• settings schemas (AC-32)<br>• secret fixtures (AC-38)<br>• How-to-play content (AC-46) | AUTO | R11, R13, R15, R27, R29, R34, R35, R42 | AC-13, AC-15, AC-18, AC-32, AC-38, AC-46 |

**Done when:** AC-13, AC-15, AC-18, AC-32, AC-38, AC-46, AC-74, AC-75.
**Proof:**
- `npm test -- -t "AC-(13|15|18|32|38|46|74)\b"`
- `npm run test:e2e -- --grep "AC-75\b"`
- `npm run ci`

**Commit:** `feat(phase-9): Most Likely To and cross-game secrecy and rejoin suites`

## Phase 10: Crews, rankings, awards, recap card

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 10.1 | **Crews:** `005_crews.sql`; create, invite link, join (guests allowed, with a sign-in nudge, per Q4); link a room to a crew | AUTO | R47, R48 | AC-50 (part) |
| 10.2 | **Seasons:** placement points; calendar-month seasons in IST (Q1); leaderboard with past seasons | AUTO | R49 | AC-51 |
| 10.3 | **Stats:** per-game stats and head-to-head | AUTO | R50 | AC-52 |
| 10.4 | **History pages:** nights with games, winners and awards | AUTO | R51 | AC-50 (part) |
| 10.5 | **Awards:** computed once at night end (SPEC §4.7) | AUTO | R52 | AC-53 |
| 10.6 | **Claim guest games:** same device only (Q3); merges results, ratings and memberships | AUTO | R3 | AC-4 |
| 10.7 | **Recap card (Should):** PNG via `next/og` at 1080 × 1350; Web Share with download fallback | AUTO | R53 | AC-54 |
| 10.8 | **E2E:** crew from creation to night history | AUTO | R47, R48, R51 | AC-50 |

**Done when:** AC-4, AC-50, AC-51, AC-52, AC-53, AC-54.
**Proof:**
- `npm test -- -t "AC-(4|51|52|53)\b"`
- `npm run test:e2e -- --grep "AC-(50|54)\b"`
- `npm run ci`

**Commit:** `feat(phase-10): crews, season leaderboard, stats, awards and recap card`

## Phase 11: Leaderboard button and big screen

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 11.1 | **Leaderboard button:** always-visible button with a live scores and teams overlay on every game phase. It keeps typed input and auto-closes when the player must act. | AUTO | R38 | AC-42 |
| 11.2 | **Big screen (Should):** `/screen` join, `huddle_screen` cookie, display layouts for all six games, lobby QR, 2-screen cap | AUTO | R54, R55 | AC-55 |

**Done when:** AC-42, AC-55.
**Proof:**
- `npm run test:e2e -- --grep "AC-(42|55)\b"`
- `npm run ci`

**Commit:** `feat(phase-11): phone leaderboard button and big-screen mode`

## Phase 12: Demo with bots

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 12.1 | **`/demo`:** a fresh demo room (`is_demo`) with the visitor as admin and 4 bots; linked from the home page | AUTO | R43 | AC-47 (part) |
| 12.2 | **Bots:** scheduled through `botPlan` / `nextWakeAt` ticks; game picker for all six games; short demo timers | AUTO | R44 | AC-47 |

**Done when:** AC-47.
**Proof:**
- `npm run test:e2e -- --grep "AC-47\b"`
- `npm run ci`

**Commit:** `feat(phase-12): solo demo with bots for every game`

## Phase 13: Design and PWA

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 13.1 | **Design tokens:**<br>• Bright light base, bold saturated accents, rounded playful shapes, type scale; dark theme<br>• Per-game accents with paired text colours: Quiz electric blue, Charades hot pink, Draw sunny yellow, Atlas green, Imposter purple, Most Likely To orange<br>• Contrast test | AUTO | R36, R91 | AC-83 |
| 13.2 | **Avatars:** 12 distinct colours, unique within a room, plus an emoji picker; shown in the lobby, scoreboard and turn indicator | AUTO | R91 | AC-84 |
| 13.3 | **Celebrations:**<br>• Lightweight confetti (particle cap) on wins<br>• Bouncy score changes<br>• Full-screen reveal cards<br>• A `prefers-reduced-motion` path | AUTO | R92 | AC-85 |
| 13.4 | **UI pass:** every screen at 360 px with 48 px targets; axe-core contrast in both themes | AUTO | R36, R37 | AC-40, AC-41 |
| 13.5 | **PWA:** manifest, generated icons (192/512/maskable), service worker caching the shell, offline screen | AUTO | R41 | AC-44 |

**Done when:** AC-40, AC-41, AC-44, AC-83, AC-84, AC-85.
**Proof:**
- `npm test -- -t "AC-83\b"`
- `npm run test:e2e -- --grep "AC-(40|41|44|84|85)\b"`
- `npm run ci`

**Commit:** `feat(phase-13): bright party design system, avatars, celebrations and PWA`

## Phase 14: Privacy page

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 14.1 | **`/privacy`:** final content covering what is collected, why, processors (Vercel, Neon, Ably, Google), retention, no ads or trackers, and contact via `NEXT_PUBLIC_CONTACT_EMAIL`. Linked from the home footer and the sign-in prompt. The About page carries the GeoNames attribution. | AUTO | R93, R76 | AC-86 |

**Done when:** AC-86.
**Proof:**
- `npm run test:e2e -- --grep "AC-86\b"`
- `npm run ci`

**Commit:** `feat(phase-14): privacy page`

## Phase 15: Full multi-player E2E suite and production verification

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| 15.1 | **Secret sniffing:** payload capture across all games for non-entitled viewers | AUTO | R34, R35 | AC-39 |
| 15.2 | **Full-night regression:** 8 contexts play a whole queue (Quiz → Draw → Imposter → Atlas → Charades → Most Likely To) with reloads, an offline spell, an AFK player and the admin leaving. Run the full E2E suite **3 times in a row green** as the flake check. | AUTO | R15, R16, R21, R26, R28 | `npm run test:e2e -- --repeat-each=3` |
| 15.3 | **Production checks:**<br>• 6 real browsers playing Quiz and Draw (AC-80)<br>• Probe re-run on the real Draw flow (AC-81)<br>• Demo on production (AC-87)<br>• Re-run AC-77, AC-78, AC-79<br>• Update `docs/deploy-checks.md` | AUTO | R2, R4, R8, R11, R43, R70 | AC-80, AC-81, AC-87 |
| 15.4 | **Wrap-up:** final README (setup, scripts, architecture, attribution); every AUTO AC `pass` with evidence | AUTO | R90 | AC table complete |

**Done when:** AC-39, AC-80, AC-81, AC-87, and every non-Manual AC is `pass` (AC-76 needs your latest push).
**Proof:**
- `npm run ci`
- `npm run test:e2e -- --grep "AC-39\b"`
- `npm run test:deploy`
- `npm run probe:draw`

**Commit:** `test(phase-15): full multi-player suite and production verification`

## Phase 16: Human acceptance

| # | Task | Tag | Refs | Done when |
|---|---|---|---|---|
| H6 | **Push** `main` (`git push`), so CI runs on the final commit | HUMAN | R90 | AC-76: Actions run green |
| H7 | **Phone install:**<br>• Android: Chrome menu → **Install app**<br>• iPhone: Safari → Share → **Add to Home Screen**<br>• On both, open the app full-screen and join a room<br>• Tell Claude pass or fail, with any notes | HUMAN | R41 | AC-45 |
| H8 | **Playtest:**<br>• ≥ 4 friends on their own phones, ≥ 3 games<br>• One phone locked, one refreshed, one with Wi-Fi turned off and back on<br>• One player signs in with Google<br>• Tell Claude what happened, or write it in `docs/playtest.md` | HUMAN | R2, R15, R21, R28, R37, R38 | AC-82 |
| 16.1 | **Fixes:** fix playtest findings that don't change SPEC (otherwise apply rule 4); record evidence for AC-45, AC-76 and AC-82; redeploy | AUTO | – | `npm run ci` green; table complete |

**Done when:** AC-45, AC-76, AC-82.
**Proof:**
- Your install and playtest reports, recorded in `docs/playtest.md`
- A green GitHub Actions run on the final commit (`gh run list --branch main --limit 1`, or the Actions tab)

**Commit:** `chore(phase-16): record install and playtest acceptance`

---

## Acceptance criteria status

Status is one of `todo`, `pass`, `fail`, `blocked-human` or `cut`. Evidence is the test file that holds the AC's test (the test name starts with the AC ID), plus the commit hash once it passes.

| ID | Type | Phase | Status | Evidence |
|---|---|---|---|---|
| AC-1 | Unit | 1 | todo | `tests/unit/identity.test.ts` |
| AC-2 | E2E | 1 | todo | `tests/e2e/identity.spec.ts` |
| AC-3 | E2E | 1 | todo | `tests/e2e/auth.spec.ts` |
| AC-4 | Unit | 10 | todo | `tests/unit/claim.test.ts` |
| AC-5 | Unit | 1 | todo | `tests/unit/realtime-token.test.ts` |
| AC-6 | E2E | 1 | todo | `tests/e2e/secrets-scan.spec.ts` |
| AC-7 | Unit | 2 | todo | `tests/unit/room-code.test.ts` |
| AC-8 | E2E | 2 | todo | `tests/e2e/rooms.spec.ts` |
| AC-9 | E2E | 2 | todo | `tests/e2e/rooms.spec.ts` |
| AC-10 | Unit | 2 | todo | `tests/unit/expiry.test.ts` |
| AC-11 | E2E | 4 | todo | `tests/e2e/quiz.spec.ts` |
| AC-12 | E2E | 2 | todo | `tests/e2e/admin.spec.ts` |
| AC-13 | Unit | 9 | todo | `tests/unit/games/invalid-actions.test.ts` |
| AC-14 | Unit | 7 | todo | `tests/unit/pipeline.test.ts` |
| AC-15 | Unit | 9 | todo | `tests/unit/views.test.ts` |
| AC-16 | E2E | 2 | todo | `tests/e2e/sync.spec.ts` |
| AC-17 | E2E | 5 | todo | `tests/e2e/draw-rejoin.spec.ts` |
| AC-18 | Unit | 9 | todo | `tests/unit/rejoin.test.ts` |
| AC-19 | E2E | 4 | todo | `tests/e2e/reconnect.spec.ts` |
| AC-20 | E2E | 4 | todo | `tests/e2e/reconnect.spec.ts` |
| AC-21 | E2E | 2 | todo | `tests/e2e/reclaim.spec.ts` |
| AC-22 | Unit | 2 | todo | `tests/unit/clock.test.ts` |
| AC-23 | E2E | 2 | todo | `tests/e2e/clock.spec.ts` |
| AC-24 | Unit | 2 | todo | `tests/unit/timers.test.ts` |
| AC-25 | Unit | 2 | todo | `tests/unit/timers.test.ts` |
| AC-26 | E2E | 5 | todo | `tests/e2e/afk.spec.ts` |
| AC-27 | Unit | 7 | todo | `tests/unit/afk.test.ts` |
| AC-28 | Unit | 2 | todo | `tests/unit/timers.test.ts` |
| AC-29 | E2E | 2 | todo | `tests/e2e/admin.spec.ts` |
| AC-30 | Unit | 2 | todo | `tests/unit/undo.test.ts` |
| AC-31 | E2E | 2 | todo | `tests/e2e/admin.spec.ts` |
| AC-32 | Unit | 9 | todo | `tests/unit/settings.test.ts` |
| AC-33 | E2E | 5 | todo | `tests/e2e/hostless.spec.ts` |
| AC-34 | E2E | 8 | todo | `tests/e2e/queue.spec.ts` |
| AC-35 | Unit | 3 | todo | `tests/unit/teams.test.ts` |
| AC-36 | E2E | 3 | todo | `tests/e2e/teams.spec.ts` |
| AC-37 | Unit | 3 | todo | `tests/unit/ratings.test.ts` |
| AC-38 | Unit | 9 | todo | `tests/unit/secrets.test.ts` |
| AC-39 | E2E | 15 | todo | `tests/e2e/secrets-sniff.spec.ts` |
| AC-40 | E2E | 13 | todo | `tests/e2e/layout.spec.ts` |
| AC-41 | E2E | 13 | todo | `tests/e2e/theme.spec.ts` |
| AC-42 | E2E | 11 | todo | `tests/e2e/leaderboard.spec.ts` |
| AC-43 | E2E | 2 | todo | `tests/e2e/turn-status.spec.ts` |
| AC-44 | E2E | 13 | todo | `tests/e2e/pwa.spec.ts` |
| AC-45 | Manual | 16 | todo | `docs/playtest.md` (install section) |
| AC-46 | Unit | 9 | todo | `tests/unit/howto.test.ts` |
| AC-47 | E2E | 12 | todo | `tests/e2e/demo.spec.ts` |
| AC-48 | Unit | 2 | todo | `tests/unit/results.test.ts` |
| AC-49 | Unit | 2 | todo | `tests/unit/rate-limit.test.ts` |
| AC-50 | E2E | 10 | todo | `tests/e2e/crews.spec.ts` |
| AC-51 | Unit | 10 | todo | `tests/unit/seasons.test.ts` |
| AC-52 | Unit | 10 | todo | `tests/unit/stats.test.ts` |
| AC-53 | Unit | 10 | todo | `tests/unit/awards.test.ts` |
| AC-54 | E2E | 10 | todo | `tests/e2e/recap.spec.ts` |
| AC-55 | E2E | 11 | todo | `tests/e2e/screen.spec.ts` |
| AC-56 | Unit | 4 | todo | `tests/unit/content/quiz.test.ts` |
| AC-57 | Unit | 4 | todo | `tests/unit/games/quiz.test.ts` |
| AC-58 | E2E | 4 | todo | `tests/e2e/quiz.spec.ts` |
| AC-59 | Unit | 4 | todo | `tests/unit/games/quiz-reports.test.ts` |
| AC-60 | Unit | 8 | todo | `tests/unit/content/movies.test.ts` |
| AC-61 | Unit | 8 | todo | `tests/unit/games/charades.test.ts` |
| AC-62 | E2E | 8 | todo | `tests/e2e/charades.spec.ts` |
| AC-63 | Unit | 5 | todo | `tests/unit/content/draw-words.test.ts` |
| AC-64 | Unit | 5 | todo | `tests/unit/strokes.test.ts` |
| AC-65 | Unit | 5 | todo | `tests/unit/games/draw.test.ts` |
| AC-66 | E2E | 5 | todo | `tests/e2e/draw.spec.ts` |
| AC-67 | Unit | 7 | todo | `tests/unit/content/places.test.ts` |
| AC-68 | Unit | 7 | todo | `tests/unit/games/atlas.test.ts` |
| AC-69 | Unit | 7 | todo | `tests/unit/games/atlas-vote.test.ts` |
| AC-70 | E2E | 7 | todo | `tests/e2e/atlas.spec.ts` |
| AC-71 | Unit | 6 | todo | `tests/unit/content/imposter-pairs.test.ts` |
| AC-72 | Unit | 6 | todo | `tests/unit/games/imposter.test.ts` |
| AC-73 | E2E | 6 | todo | `tests/e2e/imposter.spec.ts` |
| AC-74 | Unit | 9 | todo | `tests/unit/games/mlt.test.ts` |
| AC-75 | E2E | 9 | todo | `tests/e2e/mlt.spec.ts` |
| AC-76 | Deploy | 1 (final 16) | todo | GitHub Actions run URL (needs H6 push) |
| AC-77 | Deploy | 1 | todo | `tests/deploy/realtime.spec.ts`, `docs/deploy-checks.md` |
| AC-78 | Deploy | 1 | todo | `tests/deploy/neon.spec.ts`, `docs/deploy-checks.md` |
| AC-79 | Deploy | 1 | todo | `tests/deploy/google.spec.ts` |
| AC-80 | Deploy | 15 | todo | `tests/deploy/six-browsers.spec.ts` |
| AC-81 | Deploy | 1 (probe), 15 (real Draw) | todo | `scripts/probe-draw.ts` → `docs/deploy-checks.md` |
| AC-82 | Manual | 16 | todo | `docs/playtest.md` |
| AC-83 | Unit | 13 | todo | `tests/unit/design-tokens.test.ts` |
| AC-84 | E2E | 13 | todo | `tests/e2e/design.spec.ts` |
| AC-85 | E2E | 13 | todo | `tests/e2e/celebrations.spec.ts` |
| AC-86 | E2E | 14 | todo | `tests/e2e/privacy.spec.ts` |
| AC-87 | Deploy | 15 | todo | `tests/deploy/demo.spec.ts` |

---

## Decision log

Implementation choices made during the build that SPEC leaves open. The format is: date · phase · decision · reason.

- 2026-10-22 · plan · Production deploys use `npx vercel deploy --prod` from the local tree, with no Git integration, because Claude never pushes. · Keeps deploys under the build's control and independent of GitHub.
- 2026-10-22 · plan · Production migrations run in `vercel-build` against that environment's `DATABASE_URL`. · Nobody needs the `main` connection string locally.
- 2026-10-22 · plan · Engine features are tested with an internal `ping` game that exists only in test mode. · Lets Phase 2 prove the engine before any real game exists.

## Blockers

*(none)* Proposed SPEC changes go here using rule 4's format, and the build stops until the user answers.
