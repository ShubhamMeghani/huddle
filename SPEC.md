# Huddle: Specification (SPEC.md)

> Version 0.5 · 2026-10-27 · Status: approved for build (decisions recorded in §11)
> Huddle is a party-games web app for Indian friend groups. Everyone plays on their own phone. A laptop or TV can join as an optional display-only big screen.

**How to read this document**

- **Requirements** use EARS patterns: *Ubiquitous* ("The system shall…"), *Event* ("When…, the system shall…"), *State* ("While…"), *Unwanted* ("If…, then…") and *Optional* ("Where…"). Each one is tagged **Must** or **Should**.
- **Acceptance criteria** (AC-n) are pass/fail checks. Each maps to one or more R-numbers and carries one tag:
  - **Unit**: Vitest. This covers pure modules and also API handlers run against a local Postgres in CI.
  - **E2E**: Playwright with several browser contexts against a local production build (`next build` + `next start`). Every E2E spec runs in two projects: **Chromium with Android phone emulation** and **WebKit with iPhone emulation** (the Safari engine).
  - **Deploy**: Playwright or scripted checks against the production Vercel URL. These run after the owner pushes `main`; the builder never deploys.
  - **Manual**: a human check. There are only two: the friends playtest and the phone install.
- "Active player" means a seated player who is not AFK. "Viewer" means anyone receiving data: a player, a spectator or a big screen.
- All times are server times. IST (Asia/Kolkata) is used wherever a calendar date matters.

---

## 1. Goal

Build Huddle, a reliable phone-first game-night app with these games: Quiz Clash, Dumb Charades, Draw & Guess, Atlas, Imposter and Most Likely To, plus *(v0.5)* Name Place Animal Thing. A friend group can play together in one room with no host device and no setup beyond a 4-letter code.

The project succeeds when:

1. **Reliability.** A phone that locks, refreshes, loses Wi-Fi or closes its tab comes back to the **same seat with the same score and the correct time left**. This fixes the skribbl.io complaint where rejoining resets your score.
2. **Hostless play.** A night runs end-to-end with nobody acting as host. Timers advance the game, AFK players are skipped, and admin duty passes on automatically.
3. **Fairness and secrecy.** The server is the referee. Secret information (titles, words, answers, votes) reaches only the people allowed to see it.
4. **Memory.** Crews keep a season leaderboard, stats, head-to-head records, history and end-of-night awards.
5. **Evaluable alone.** The app is deployed on Vercel, and the professor can open `/demo` alone and play every game against bots.
6. **Feel.** The app looks bright, playful and celebratory, and can be read at a glance on a 360 px phone.

---

## 2. Users and main scenarios

### 2.1 Users

| User | Description |
|---|---|
| Guest player | Joins instantly with any name. A device token keeps their seat. |
| Signed-in player | Has optionally signed in with Google, giving a permanent profile across devices. Can claim earlier guest stats. |
| Admin | The room creator, or whoever admin was passed to. Can moderate the room but is not required for play. |
| Spectator / late joiner | Watches the live game. Is seated at the next round. |
| Big screen | A laptop or TV joined by code or QR. Display-only and not a player. |
| Crew member | Belongs to a saved friend group that has a season leaderboard and history. |
| Evaluator (professor) | Plays `/demo` alone against bots, with no sign-in. |

### 2.2 Scenarios

**S1. Hostless night, no big screen.** Seven friends are in a hostel room. Aarav creates a room on their phone and drops the link in the group chat. Everyone else taps the link, types a name and is seated. Aarav queues Quiz Clash → Draw & Guess → Imposter and starts, then heads to the kitchen with the phone locked. Nobody needs to touch anything: timers move the games along, and every phone has a small 🏆 button that shows live scores and teams. When Aarav has been unreachable for 60 s, admin passes to Diya, the longest-present player. Aarav returns later and is still seated with the same score.

**S2. Night with a big screen.** The group plugs a laptop into the TV and opens `huddle…/screen`. The lobby QR on the screen lets people join. During Draw & Guess the TV shows the live drawing, the timer and the leaderboard, but never the word. Phones show only each person's own controls.

**S3. AFK player.** Kabir goes to collect a food delivery mid-game. Kabir's drawing turn times out and is skipped. After two missed turns Kabir is marked AFK: later turns are skipped immediately, quiz questions no longer wait for Kabir, and Kabir's seat and score are kept. When Kabir taps "I'm back", Kabir plays again from the next turn.

**S4. Phone rejoins mid-game.** Meera's phone locks for 40 s while Meera is guessing in Draw & Guess. On unlock, the app fetches a fresh snapshot and shows the same seat, the same score, the full drawing so far and the correct seconds left. Wi-Fi drops and full browser restarts also land in the same place. If Meera opens the room in a different browser that has no token, Meera taps "That's me" on the disconnected seat and the admin approves.

**S5. Crew season.** The "Hostel 4B" crew plays every Friday. Each room is linked to the crew, so results flow into the October season leaderboard, per-game stats and head-to-head records. At the end of the night everyone sees awards (MVP, Best Artist, Fastest Finger, Best Imposter, Most AFK) and can share a recap card image.

**S6. Late joiner.** Rohan arrives during the third Quiz question. Rohan watches as a spectator and is seated with 0 points from the next question.

**S7. Evaluator demo.** The professor opens `/demo` on a laptop. A room with four bots appears. The professor picks each game from a list and plays short rounds; the bots answer, draw, act, name places, give clues and vote.

**S8. Claim later.** Priya plays a night as a guest. A week later, on the same phone, Priya signs in with Google and taps "Claim my guest games". That night's results and ratings now belong to Priya's profile and are visible from a laptop too.

---

## 3. Constraints

| Area | Constraint |
|---|---|
| Stack (fixed) | Next.js App Router with TypeScript (strict), Tailwind CSS, Vitest, Playwright, Node.js 24 LTS. |
| Hosting | Vercel Hobby, non-commercial. Serverless functions only: no long-running process and no background loop. Vercel Cron runs at most daily (used only for cleanup). Vercel is connected to the public GitHub repo `github.com/ShubhamMeghani/huddle` and deploys production **only when the owner pushes `main`**. The builder never deploys and never pushes. |
| Database | Neon Postgres via `DATABASE_URL`, server-only. Uses `pg` everywhere: over TCP to Neon's pooled endpoint in production, with `attachDatabasePool` from `@vercel/functions` closing idle connections before Vercel suspends an instance, and a 30 s limit on getting a connection, including waiting for a pool slot. One `db` module. *(v0.4: replaces `@neondatabase/serverless`, whose WebSocket pool must not outlive a request.)* |
| Realtime | Ably. `ABLY_API_KEY` is server-only. Clients get short-lived tokens (Ably TokenRequests) from `/api/realtime/token`; the root key never reaches the browser. Clients only **subscribe**, and the server does all publishing. |
| Auth | Auth.js (next-auth v5) with Google as **optional** sign-in, JWT sessions, and `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Guests never need an account. |
| AI | No AI APIs at runtime. All content (questions, movies, words, pairs, prompts) is written ahead of time and bundled. |
| Secrets | Secrets live only in `.env.local` and in Vercel env settings. `.env.local` is never read by tools or agents, and no key is ever pasted into chat. `.env.example` lists variable names with empty values. |
| Test mode | `HUDDLE_TEST_MODE=1` enables: a seeded RNG header, timers down to 2 s, a test Credentials provider that stands in for Google, a realtime "drop message" hook, and `REALTIME_DRIVER=local` (in-process pub/sub over SSE instead of Ably). Test mode is refused whenever `VERCEL_ENV` is set, so it can never be on in preview or production. |
| CI | GitHub Actions on `ubuntu-24.04` with a Postgres 16 service container. CI has no Ably or Google secrets, so E2E runs use the local realtime driver. Deploy checks run against production from the developer machine after a push. |
| Time budget | About 3 days, built mostly autonomously by Claude Code. Should items are built last and are the first to be cut. |
| Free tiers | Must fit Ably Free, Neon Free and Vercel Hobby for a class demo plus about 10 game nights a month (budget in §7). |
| Devices | Safari on iOS 16+ (the evaluator uses an iPhone) and Chrome on Android (last 2 versions) are primary. Desktop Chrome, Firefox, Safari and Edge must also work. Must work at 360 px width. |
| Performance | p95 action-to-update latency ≤ 1 s on production. Each route's first-load JS ≤ 250 KB gzipped. |
| Language | UI in English. Content may use Hinglish and Indian references. |
| Licensing | GeoNames data is CC BY 4.0, with attribution shown in-app. All other content is original. |

---

## 4. Inputs and outputs

### 4.1 Data model (Postgres)

The authoritative state of a live room is **one JSONB document per room** with a version number. It is changed only inside a transaction that holds a row lock (`SELECT … FOR UPDATE`). Everything else is either append-only or derived.

| Table | Key columns | Purpose |
|---|---|---|
| `identities` | `id uuid PK`, `kind (guest/user)`, `display_name`, `device_token_hash` (SHA-256, unique, null for users), `user_id → users`, `merged_into → identities`, `created_at` | One row per guest device or signed-in user. Seats point here. |
| `users` | `id uuid PK`, `google_sub unique`, `email`, `name`, `image`, `created_at` | Permanent profiles, upserted in the Auth.js sign-in callback. |
| `rooms` | `id uuid PK`, `code char(4)`, `crew_id → crews null`, `is_demo bool`, `state jsonb`, `version int`, `created_at`, `last_activity_at`, `expires_at`, `ended_at` | Live room. A partial unique index on `code` covers unexpired rooms only. |
| `room_actions` | `room_id`, `action_id uuid`, `identity_id`, `type`, `payload jsonb`, `result jsonb`, `version_after`, `created_at`; `UNIQUE(room_id, action_id)` | Idempotency and audit log. A replayed `action_id` returns the stored `result`. |
| `presence` | `room_id`, `identity_id`, `last_seen_at`; `PK(room_id, identity_id)` | Heartbeats, kept separate so they never lock or version the state row. |
| `strokes` | `room_id`, `turn_id`, `seq int`, `ops jsonb`, `created_at`; `PK(room_id, turn_id, seq)` | Append-only drawing log per turn (§4.5). |
| `games` | `id uuid PK`, `room_id`, `crew_id null`, `game_type`, `settings jsonb`, `started_at`, `ended_at` | One row per completed game. Kept forever. |
| `game_results` | `game_id`, `identity_id`, `team null`, `rank`, `score`, `placement_points`, `stats jsonb` | Per-player results and game-specific stats (answer times, guesses, places, imposter role). |
| `nights` | `room_id PK`, `crew_id null`, `date_ist`, `awards jsonb`, `recap jsonb` | End-of-night summary, written when a night ends or a room expires. |
| `ratings` | `identity_id`, `game_type`, `rating real default 1000`, `games int`; `PK(identity_id, game_type)` | Inputs to team balancing (§4.6). |
| `crews` | `id uuid PK`, `name`, `invite_token unique`, `created_by → identities`, `created_at` | Saved friend groups. |
| `crew_members` | `crew_id`, `identity_id`, `joined_at`; `PK(crew_id, identity_id)` | Membership. |
| `question_reports` | `question_id`, `identity_id`, `reason`, `created_at`; `PK(question_id, identity_id)` | "Report question" (one report per player per question). |
| `place_suggestions` | `name_normalized`, `room_id`, `accepted bool`, `created_at` | Unknown Atlas places that went to a vote, kept for later review of the dataset. |

**Room state document** (TypeScript, abbreviated):

```ts
type RoomState = {
  v: number;                        // equals rooms.version
  status: 'lobby' | 'playing' | 'break' | 'ended';
  adminSeatId: string;
  seats: Seat[];                    // up to 12 'seated' + spectators
  teams: { id: string; name: string; seatIds: string[] }[] | null;
  queue: GameConfig[]; queueIndex: number;
  phase: { id: number; kind: string; deadline: number | null }; // epoch ms
  paused: { remainingMs: number; at: number } | null;
  game: GameState | null;           // per-game state from the pure module
  scoreEvents: ScoreEvent[];        // current game, used for undo
  nightTotals: Record<SeatId, number>;
  rngSeed: string;                  // deterministic replays and tests
  botPlan: { seatId: string; dueAt: number; action: Action }[];
  notices: Notice[];                // last 10 admin/system notices
};
type Seat = {
  id: string; identityId: string; name: string; joinedAt: number;
  status: 'seated' | 'spectator' | 'kicked'; seatAtNextRound: boolean;
  missedTurns: number; afk: boolean; isBot: boolean; teamId: string | null;
  score: number;                    // current game
};
```

Each game is a **pure module** in `src/games/<game>/` with the same interface. It has no I/O and uses only an injected clock and RNG:

```ts
init(settings, seats, ctx) → GameState
apply(state, action, ctx) → { state, events } | { error: ErrorCode }
onDeadline(state, ctx) → { state, events }     // phase expiry and AFK skips
view(state, viewer) → GameView                 // the ONLY way data leaves the server
botAct(state, botSeatId, ctx) → Action | null  // used by /demo
```

### 4.2 Message and sync protocol

**Identity on requests.** A guest sends the `huddle_dt` cookie (httpOnly, Secure, SameSite=Lax, 1 year, holding a random 128-bit device token). A signed-in user sends the Auth.js session cookie. A big screen sends the `huddle_screen` cookie (scoped to one room, display-only).

**HTTP API** (all JSON; every response includes `serverNow`):

| Method and path | Who | Purpose |
|---|---|---|
| `POST /api/identity/guest` `{name}` | anyone | Create a guest identity and set `huddle_dt`. |
| `POST /api/identity/claim` | signed-in user with a guest cookie | Merge guest results and ratings into the profile. |
| `GET /api/realtime/token` | player, spectator, screen | Return an Ably TokenRequest: capability `{"huddle:room:<roomId>":["subscribe"]}`, TTL 60 min. |
| `POST /api/rooms` `{settings, crewId?}` | identity | Create a room and return `code`. |
| `POST /api/rooms/:code/join` | identity | Seat or spectate. Idempotent for an existing seat. |
| `GET /api/rooms/:code/snapshot` | viewer | Return `{v, serverNow, view}` built by `viewFor(state, viewer)`. |
| `POST /api/rooms/:code/actions` `{actionId, type, payload}` | player or admin | Validate, apply, persist, publish. Returns `{ok:true, v, private?}` or `{ok:false, code, v}`. |
| `POST /api/rooms/:code/tick` `{phaseId}` | any viewer | Process an expired deadline or due bot actions (idempotent). |
| `POST /api/rooms/:code/heartbeat` | player | Update `presence` and return the current `v`. |
| `POST /api/rooms/:code/strokes` `{turnId, seq, ops}` | current drawer | Append a stroke batch and publish it. |
| `GET /api/rooms/:code/strokes?turnId&after` | viewer | Fetch stroke batches after `seq`, used for catch-up. |
| `POST /api/rooms/:code/screen` | anyone with the code | Register a big screen and set `huddle_screen`. |
| `POST /api/crews`, `POST /api/crews/join/:invite`, `GET /api/crews/:id/…` | identity | Crews, leaderboard, stats, history. |
| `POST /api/questions/:id/report` `{reason}` | player | Report a quiz question. |
| `GET /api/recap/:roomId/image` | anyone with the link | Recap card PNG (Should). |

Error codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `KICKED`, `NOT_ADMIN`, `WRONG_PHASE`, `NOT_YOUR_TURN`, `INVALID`, `RATE_LIMITED`, `PAUSED`.

**Action pipeline** (one transaction per action):

1. Authenticate the identity and resolve the seat.
2. If `room_actions` already has this `(room_id, action_id)`, return the stored result.
3. `SELECT … FOR UPDATE` the room row.
4. Run catch-up: process overdue deadlines and due bot actions (§4.3).
5. Validate the payload with zod, then call `apply()`. On error, roll back and return the code.
6. Write `state` and `version+1`, insert into `room_actions`, and commit.
7. **After commit**, publish `state` to Ably. If the publish fails, it is logged and the client recovers through gap detection or the heartbeat.

**Realtime channel.** There is exactly one public channel per room, `huddle:room:<roomId>`. The room UUID is used rather than the code, so codes can be reused. Clients only subscribe. Messages:

| Name | Body | Notes |
|---|---|---|
| `state` | `{v, serverNow, view: PublicView, privateFor: seatId[]}` | `view` is `viewFor(state, PUBLIC)` and must be ≤ 16 KB. `privateFor` lists seats whose private view changed in this version. |
| `strokes` | `{turnId, seq, ops}` | Drawing batches (§4.5). These do not change `v`. |

Secrets never travel over Ably. A client whose seat appears in `privateFor` fetches its snapshot over authenticated HTTPS. This happens rarely: at a round start, a word choice, or a chat line visible only to guessers. Feedback that only the actor should see (for example "you're close!") comes back in that action's own HTTP response as `private`.

**Client sync rules.**

- On `state` with `v ≤ local.v`: ignore it.
- With `v = local.v + 1`: apply the public view, and fetch a snapshot if the client's own seat is in `privateFor`.
- With `v > local.v + 1`: fetch a snapshot.
- Also fetch a snapshot on first load, on Ably `connected`/`resumed`, on `visibilitychange → visible`, on `focus` and on `online`.
- While visible, send a heartbeat every 25 s. If the reply has `v > local.v`, fetch a snapshot.
- If Ably has not been connected for 10 s, poll the snapshot every 3 s and show a "Reconnecting…" pill until Ably is back.
- Draw catch-up: a gap in stroke `seq`, or a snapshot taken mid-turn, triggers `GET strokes?after=lastSeq`.
- *(v0.4)* Requests time out and then count as a network failure: snapshot, heartbeat and tick after 10 s (a snapshot fetch is retried, so one stalled request never blocks later catch-ups), actions after 30 s (retried once with the same `actionId`, so a slow tap waits rather than being dropped).

### 4.3 Timer handling

- Every timed phase has `phase.id` (monotonic) and `phase.deadline` (absolute epoch ms on the server clock).
- **Clock offset.** The client estimates `offset = serverNow − (t_send + t_recv)/2` from the sample with the lowest round-trip time among the last 5 responses. Displayed seconds are `ceil((deadline − (Date.now() + offset)) / 1000)`. All phones, and any rejoining phone, therefore show the same countdown.
- **Expiry.** When a client's local countdown reaches 0, it waits a random 0–300 ms and sends `POST tick {phaseId}`. The server locks the row, then:
  - if `phase.id ≠ phaseId` it returns the current state (no-op);
  - if `now < deadline` it returns `{early:true}` (no-op);
  - otherwise it runs `onDeadline` exactly once.
  The public view also exposes `nextWakeAt = min(phase.deadline, earliest botPlan.dueAt)`, so clients tick bots too.
- **Catch-up.** Every action, tick and snapshot request processes overdue deadlines first, in order, capped at 50 steps. A turn whose player's phone is off is therefore still skipped as soon as anyone else's phone is active.
- **All phones silent.** If the most recent human contact (any request) is more than 120 s old when catch-up runs, the server **pauses** the game instead of fast-forwarding. Remaining time is restored to its value at the last contact, with a minimum of 10 s.
- **Pause.** Pausing stores `remainingMs`. Resuming sets `deadline = now + remainingMs`. Ticks are no-ops while paused.
- **AFK.** When a turn expires without the turn owner acting, that seat's `missedTurns` increases by 1. At 2 consecutive misses the seat becomes `afk = true`. An AFK seat's turns are skipped immediately (no points), and AFK seats are excluded from "everyone has answered or voted" checks. Any action from that seat, or an "I'm back" tap, resets `afk` and `missedTurns`. In simultaneous games (Quiz, Imposter votes, Most Likely To) a missed turn means a phase with no answer or vote.
- **Admin hand-off.** During catch-up, if the admin's `presence.last_seen_at` is more than 60 s old, or the admin is AFK, admin passes to the connected (seen within 60 s), non-AFK, non-bot seated player with the earliest `joinedAt`.

### 4.4 Secret visibility matrix

| Game | Secret | Who sees it before reveal | When everyone sees it |
|---|---|---|---|
| Quiz Clash | correct option | nobody (not even the admin) | reveal phase |
| Dumb Charades | movie title and metadata | the current actor only | after Guessed, timeout or steal window |
| Draw & Guess | 3 word choices and chosen word | drawer only (others get the mask, e.g. `_ _ _ _   _ _ _`, plus revealed hint letters) | turn end |
| Draw & Guess | chat lines from players who already guessed | drawer and players who already guessed | never shown to the others |
| Imposter | each player's word; who the imposter is | each player sees only their own word; nobody sees the imposter's identity | reveal phase |
| Most Likely To | who voted for whom | nobody, ever (not stored after the round) | only totals are revealed |
| Name Place Animal Thing *(v0.5)* | each player's answers | the author only | when the writing ends |
| Any | other players' device tokens, emails | nobody | never |

### 4.5 Drawing strokes

- **Canvas.** The logical canvas is 1000 × 750 units (4:3) and is scaled to the device. Points are quantised to integers.
- **Ops:**
  - `{k:'s', id, seg, c, w, e, p}`: stroke segment. `c` is a palette index (12 colours), `w` a size index (4 sizes), `e` marks the eraser, and `p` is a delta-encoded flat array `[x0,y0,dx1,dy1,…]`.
  - `{k:'u', id}`: undo a stroke.
  - `{k:'c'}`: clear.
- **Batching.** The drawer client flushes every 200 ms, or sooner at 64 points. One batch is one `POST strokes` carrying `seq` (assigned by the drawer, monotonic, unique per turn).
- **Simplification.** Ramer–Douglas–Peucker with ε = 0.75 units runs on each segment before sending. Rendering uses quadratic smoothing. The invariant, unit-tested, is that the Hausdorff distance between the raw and the simplified polyline is ≤ 1 unit (0.1 % of the width), which is invisible at phone and TV sizes.
- **Server checks.** The sender is the current drawer and the turn is current. The batch is ≤ 8 KB. There are ≤ 8 batches/s per room. A duplicate `seq` is ignored (idempotent). Then the server inserts into `strokes` and publishes `strokes`. The state row is **not** locked for stroke batches.
- **Replay.** The snapshot or `GET strokes` returns all ops of the current turn, and clients replay them in `seq` order.

### 4.6 Scores, placement points, ratings and team balancing

- **Rank.** Within a game, rank is by game score (descending). Ties share a rank. In team games, every member gets the team's rank.
- **Placement points** (for crew seasons). With `n` ranked units (players, or teams in team games) where `n ≥ 2`: `pp = round(100 × (n − r) / (n − 1))` for a 1-based position `r`. Tied units get the average of the positions they cover. A game with `n = 1` earns no placement points.
- **Rating method (multiplayer Elo).** Ratings are kept per identity per game type, starting at 1000. After a completed game with `n` ranked participants (team members carry the team's rank):
  - for each pair `(i, j)`: `E_ij = 1 / (1 + 10^((R_j − R_i)/400))` and `S_ij ∈ {1, ½, 0}` from the ranks;
  - `ΔR_i = (K / (n − 1)) × Σ_j (S_ij − E_ij)` with `K = 32`.
  Players who beat stronger players gain more. With two players this reduces to classic Elo.
- **Team balancing.** Each player's strength is their rating for the chosen game, falling back to the mean of their other game ratings, then to 1000.
  1. Sort players by strength (descending) and snake-draft them into `k` teams.
  2. Repeatedly apply the single cross-team swap that most reduces `max(team mean) − min(team mean)` until no swap helps.
  Team sizes differ by at most 1. The result is deterministic for a given input order (ties broken by seat id). The admin can then edit, shuffle or rebalance.

### 4.7 End-of-night awards

| Award | Definition | Tie-break |
|---|---|---|
| MVP | Highest sum of placement points over all games that night | more game wins, then earlier join |
| Best Artist | Highest average drawer points per Draw & Guess turn (needs ≥ 1 turn drawn) | more correct guessers |
| Fastest Finger | Lowest median correct-answer time in Quiz Clash (needs ≥ 5 correct) | more correct answers |
| Best Imposter | Most Imposter wins as imposter, counting steals | fewer votes received |
| Most AFK | Most turns skipped while AFK (needs ≥ 1) | more missed turns |

An award is omitted when its game was not played or nobody qualifies.

### 4.8 Bundled content (inputs)

| File | Minimum size | Required fields | Automated checks |
|---|---|---|---|
| `content/quiz.json` | ≥ 400 questions; ≥ 40 in each of Bollywood, Hollywood, Cricket, India GK, World GK, Science, Sports | `id, category, difficulty, question, options[4], answer (0–3)` | unique ids; no duplicate normalised question text; 4 distinct options; answer in range; question ≤ 140 chars; option ≤ 40 chars; no time-relative words ("current", "latest", "this year") |
| `content/movies.json` | ≥ 200 Bollywood and ≥ 200 Hollywood | `id, industry, title, year, era, difficulty` | unique (industry, normalised title); year 1930–2026; era matches year (Classic < 1990, Golden 1990–2009, Modern ≥ 2010); every era non-empty per industry |
| `content/draw-words.json` | ≥ 500, with ≥ 75 tagged `india` | `word, difficulty, tags[]` | unique normalised words; only letters, spaces and hyphens; 3–20 chars |
| `content/imposter-pairs.json` | ≥ 150 pairs | `id, a, b, category, hintsA[2], hintsB[2]` | unordered pairs unique; a ≠ b; hints don't contain their own word (hints feed the bots) |
| `content/mlt-prompts.json` | ≥ 150 | `id, text` | unique; ≤ 100 chars; starts with "Most likely to" |
| `content/npat-bot.json` *(v0.5)* | every Name Place Animal Thing letter | letter → `name[], animal[], thing[]` | every word starts with its letter; names and things for every letter (bot answers only) |
| `content/bot-drawings.json` | ≥ 20 drawings | `word, ops[]` | every word exists in `draw-words.json`; ops valid |
| `data/places.json` (generated) | countries, capitals, Indian states and UTs, Indian cities ≥ 15 000 population, world cities ≥ 100 000 | `id, name, alt[], kind, country, inIndia` | all 193 UN members; 28 states and 8 UTs; built by `scripts/build-places.ts` from GeoNames dumps; Latin-script alternate names only; server-only |

Outputs to users are defined throughout: per-viewer views, scoreboards, crew pages, awards and recap images.

---

## 5. Requirements

### 5.1 Core platform: identity and security

- **R1 (Must)** When a visitor enters a name and taps Join or Create, the system shall create a guest identity with a device token cookie, with no sign-in required. Any name of 1–24 characters after trimming is accepted, in any script and with emoji, and no word filter is applied.
- **R2 (Must)** Where a user chooses to sign in with Google, the system shall create or load a permanent profile, and shall restore that user's seat in a room on any device where they are signed in.
- **R3 (Must)** When a signed-in user's device still holds a guest token, the system shall offer "Claim my guest games". On confirmation it shall merge that guest identity's results, ratings and crew memberships into the profile, exactly once.
- **R4 (Must)** The system shall keep `ABLY_API_KEY`, `DATABASE_URL`, `AUTH_SECRET` and `AUTH_GOOGLE_SECRET` server-only. Clients shall receive Ably tokens with TTL ≤ 60 min and capability limited to **subscribe** on their room's public channel.

### 5.2 Core platform: rooms

- **R5 (Must)** When an identity creates a room, the system shall generate a 4-letter code that is unique among unexpired rooms and uses an alphabet without I, L and O. It shall make the creator admin and show the code, a join link and a QR code.
- **R98 (Must)** *(v0.5)* The lobby shall show a large "Share on WhatsApp" button that opens WhatsApp with a prefilled invite (the room code and join link), and a large QR code of the join link. Each device shall remember the player's name, so joining another room needs one tap ("Join as <name>"), even when the device no longer has its guest cookie.
- **R6 (Must)** When a visitor opens a join link, scans the QR or types a code, the system shall open that room's join screen. If the code is unknown or expired, then the system shall show "Room not found" with a Create room button.
- **R7 (Must)** The system shall seat at most 12 players per room. If a room is full, then a newcomer shall be offered to watch as a spectator.
- **R8 (Must)** The system shall keep a room and its state for 24 hours after its last activity and then expire it. The code becomes reusable, but completed game results and night summaries are kept permanently.
- **R9 (Must)** When someone joins while a game is running, the system shall make them a spectator showing the live public view, and seat them at the start of the next round (Quiz: next question; Draw, Charades, Imposter: next round; Atlas: next game; Most Likely To: next prompt). In team games they go to the smallest team.
- **R10 (Must)** If a kicked identity tries to rejoin or spectate that room, then the system shall refuse with `KICKED`.

### 5.3 Core platform: server referee and sync

- **R11 (Must)** The system shall process every player action through an API route that validates it against the current state and the game's pure rules module, saves the new state with version + 1, and publishes the update only after the commit. If an action is invalid (wrong phase, not your turn, malformed, paused), then the system shall return a reason code and leave state and version unchanged.
- **R12 (Must)** When an action with an already-processed action ID arrives, the system shall return the original result without applying it again. Concurrent actions on one room shall be serialised so that each is validated against the latest state.
- **R13 (Must)** The system shall serve, at any time, a snapshot of the full current view for the requesting viewer. This covers version, phase, deadline, seats, scores, teams and only the secrets that viewer may see.
- **R14 (Must)** When a client sees a version gap, connects or reconnects to realtime, or becomes visible, focused or online, the client shall fetch a snapshot and replace its view.
- **R15 (Must)** When a device with its seat token (or signed-in profile) reopens a room after a lock screen, refresh, network drop, closed tab or browser restart, the system shall restore the same seat, team, score and current game view, with the correct time left. No code path shall reset a seated player's score on rejoin.
- **R16 (Must)** If the realtime connection has been down for more than 10 s, then the client shall poll the snapshot every 3 s and show a "Reconnecting…" indicator until realtime recovers. The game shall stay fully playable while polling.
- **R17 (Must)** When a device without the seat's token taps "That's me" on a disconnected seat, the system shall move the seat to that device after approval by the admin, or by any other connected player when the seat is the admin's own. The old token stops working for that seat.

### 5.4 Core platform: timers and AFK

- **R18 (Must)** The system shall express every timer as a server-issued absolute deadline and include server time in every response, so that all phones and rejoining phones show the same countdown within 1 s (§4.3).
- **R19 (Must)** When any client reports an expired deadline, or any request reaches a room with overdue deadlines or due bot actions, the system shall process them in order and exactly once per phase, and only once the server clock confirms expiry.
- **R20 (Must)** If no human player has contacted the server for more than 2 minutes during a game, then the system shall pause the game on the next request instead of fast-forwarding through turns.
- **R21 (Must)** When a player's turn or answer phase expires without their action, the system shall skip it with no points and count a missed turn. After 2 consecutive misses it shall mark the player AFK. While a player is AFK, the system shall skip their turns immediately, exclude them from "everyone has acted" checks, keep their seat and score, and show an AFK badge.
- **R22 (Must)** When an AFK player performs any action or taps "I'm back", the system shall clear their AFK status and missed-turn count.
- **R23 (Must)** While a game is paused, the system shall freeze all deadlines and show a paused overlay on every device. On resume it shall restore exactly the remaining time.

### 5.5 Core platform: admin and hostless play

- **R24 (Must)** The system shall let the admin skip the current turn, kick a player, pause and resume, end the current game and transfer admin. Every admin action shall appear as a short notice on all devices. Non-admin attempts shall be rejected with `NOT_ADMIN`.
- **R25 (Must)** When the admin taps Undo, the system shall revert the most recent not-yet-undone scoring event of the current game, and may repeat this back to the start of the game. It shall notify all players.
- **R26 (Must)** If the admin leaves, has not been seen for 60 s, or is AFK, then the system shall pass admin to the connected, non-AFK, human seated player who has been present longest.
- **R27 (Must)** The system shall allow game settings to change only in the lobby or a scoreboard break, and shall reject changes during a game.
- **R28 (Must)** While no admin action occurs, the system shall still run every game and the whole queue from start to finish using deadlines alone.

### 5.6 Core platform: lobby, queue and teams

- **R29 (Must)** The system shall let the admin build a game queue of one or more games. Each game has house rules (rounds, timers, points and, where relevant, categories, difficulty or era, variants and the steal rule) with defaults and validated ranges.
- **R97 (Must)** *(v0.5)* The system shall offer Quick, Normal and Long presets for every game in the queue, each with an estimated duration for the seated players (for example "~8 min"), and a total for the queue. A newly added game uses Normal, which equals its defaults. Presets change only rounds and timers; the full house rules stay reachable under Advanced, and settings that match no preset show as Custom.
- **R30 (Must)** When a game ends, the system shall record results, show a scoreboard break (default 30 s; the admin may continue early) and start the next queued game. When the queue is done or the admin taps End night, it shall show the night summary.
- **R31 (Must)** When the admin taps Rematch, the system shall replay the last game or queue with the same seated players and the same teams.
- **R96 (Must)** *(v0.5)* While in the lobby, the system shall offer the admin a "Pick for us" button that adds a random game whose minimum player count (§11 Q9) is met by the seated players, preferring games not yet queued or played that night, and names the pick. With too few players for any game, it shall say so instead.
- **R32 (Must)** When a team game is set up, the system shall propose teams auto-balanced by rating (§4.6) with sizes differing by at most one. The admin shall be able to move players, shuffle or rebalance before the start.
- **R33 (Must)** When a game completes, the system shall update every participant's rating for that game type using the multiplayer Elo method in §4.6.

### 5.7 Core platform: secrecy

- **R34 (Must)** The system shall deliver secret information only to the viewers allowed to see it, as listed in the visibility matrix (§4.4), until its reveal.
- **R35 (Must)** The system shall build every outgoing payload (snapshots, action responses, realtime messages and big-screen views) through the single per-viewer `view()` function. Realtime messages shall carry only the public view.

### 5.8 Core platform: mobile UX, PWA and demo

- **R36 (Must)** The system shall use a bright, light theme by default, whatever the OS colour scheme: a light base, bold saturated accents and playful rounded shapes. It shall offer a dark theme toggle that is remembered per device. All text and essential UI shall meet WCAG 2.2 AA contrast in both themes.
- **R37 (Must)** The system shall be fully usable at 360 px width with no horizontal scrolling, and primary tap targets of at least 48 × 48 px. Layouts shall use iOS-safe viewport units (`dvh`/`svh`, never bare `100vh`) and respect safe-area insets (`viewport-fit=cover` with `env(safe-area-inset-*)` padding).
- **R91 (Must)** The system shall give each game a distinct colour identity, used on its screens, buttons and How-to-play sheet: Quiz Clash electric blue, Dumb Charades hot pink, Draw & Guess sunny yellow, Atlas green, Imposter purple, Most Likely To orange, and *(v0.5)* Name Place Animal Thing cyan. Each accent has a paired text colour that meets AA. Every seated player shall get a colourful avatar (a colour unique within the room plus an emoji the player can change), shown in the lobby, scoreboards and turn indicators.
- **R92 (Must)** When a celebratory moment happens (a game win, a correct guess, a score change, or a big reveal of an answer, title, imposter or tally), the system shall animate it with confetti on wins, bouncy score changes and full-screen reveal cards. Where the device requests reduced motion (`prefers-reduced-motion: reduce`), the system shall show the same information with no confetti and only instant changes or fades of ≤ 150 ms.
- **R38 (Must)** While a game is running, every phone shall show an always-visible leaderboard button. It opens live scores and teams as an overlay without pausing the game, losing typed input or hiding the countdown, and the overlay closes automatically when the player must act.
- **R39 (Must)** The system shall always show each player whether it is their turn ("Your turn" or "Waiting for <name>") and the synced countdown.
- **R40 (Must)** When a player's turn starts and the device supports vibration (and the player has not turned it off), the system shall vibrate once gently (≤ 200 ms). Where a feature is missing (for example vibration on iOS), the app shall degrade silently, with no error or prompt. The app shall play no sounds.
- **R41 (Must)** The system shall be an installable PWA (manifest, icons, service worker caching the app shell), installable on Android through Chrome and on iPhone through Safari's "Add to Home Screen" (180 px `apple-touch-icon`, `apple-mobile-web-app-capable` and title meta tags). It shall show a friendly offline screen when there is no network.
- **R42 (Must)** The system shall give every game a "How to play" sheet with rules, scoring and timers. It is available in the lobby and during play.
- **R95 (Must)** *(v0.5)* When a game starts in a room that has not played that game before, the system shall first show every phone and the big screen a How-to-play card: three short lines and one example. The first round starts when every active human player has tapped "Got it", when the card's timer (20 s) ends, or when the admin skips. The card is not shown again for that game in that room. The admin can turn the cards off in the lobby.
- **R93 (Must)** The system shall publish a privacy page at `/privacy`, reachable without sign-in and linked from the home page and the sign-in prompt. It shall state:
  - what is collected: display names, device token, Google name, email and picture, and game results;
  - why it is collected;
  - who processes it: Vercel, Neon, Ably and Google;
  - how long it is kept: rooms for 24 h after last activity, results until deletion is requested;
  - that there are no ads or trackers;
  - how to ask questions or request data deletion: a link to the GitHub Issues page, `https://github.com/ShubhamMeghani/huddle/issues`.
- **R94 (Should)** *(v0.4)* Where Google sign-in is configured, the home page shall offer Sign in at the top, next to the theme toggle, and in the Your crews card ("Sign in to keep your stats on every device"). While signed in, the top of the home page shall show the user's name and avatar and a Sign out control instead.
- **R43 (Must)** When a visitor opens `/demo` on the public production URL, the system shall create a fresh demo room with the visitor as admin and 4 bot players, with no sign-in and a link from the home page.
- **R44 (Must)** While in a demo room, the system shall let the visitor pick any game *(v0.5: not only the first six)* with short default timers. Bots shall take plausible actions in each one (answer, act, draw from bundled drawings, guess, name places, give clues, vote), scheduled as server deadlines, so one person can finish every game.
- **R45 (Must)** When a game ends, the system shall permanently record its results (players, teams, ranks, scores, game-specific stats) independently of room expiry, exactly once.
- **R46 (Should)** If a client sends more than 10 actions per second, or more than 3 chat messages in 2 s, then the system shall reject the excess with `RATE_LIMITED`.

### 5.9 Crews and rankings (Must)

- **R47 (Must)** When an identity creates a crew with a name, the system shall create it with a secret invite link. When an identity opens the link, the system shall add it as a member.
- **R48 (Must)** Where a room is linked to a crew (at creation or in the lobby), the system shall add each completed game and the night summary to that crew's records.
- **R49 (Must)** The system shall show a crew season leaderboard (default season: calendar month in IST, with earlier seasons browsable). It ranks members by total placement points (§4.6) and shows games played, wins and average points.
- **R50 (Must)** The system shall show per-member, per-game stats and the head-to-head record between any two members (games together, and who placed higher).
- **R51 (Must)** The system shall show crew history: each night with its date, games, winners and awards.
- **R52 (Must)** When a night ends (End night, the queue finishes with no rematch for 10 min, or the room expires), the system shall compute the awards in §4.7 once, show them on every device and store them.

### 5.10 Big screen and recap (Should)

- **R53 (Should)** When a night ends, the system shall generate a shareable recap card image (PNG, 1080 × 1350) with final standings and awards. It is shared through the Web Share API where available, with a download as fallback.
- **R54 (Should)** When a laptop or TV opens `/screen` and enters a room code, or scans the room's screen QR, the system shall show a display-only big screen that is not a player. It shows the lobby QR, the current game's public view (question, drawing, timer, reveals), a live leaderboard and teams.
- **R55 (Should)** The big screen shall resync like a phone (snapshot on reconnect) and shall never receive secret information.

### 5.11 Game 1: Quiz Clash (Must)

- **R56 (Must)** The system shall bundle at least 400 original four-option questions across Bollywood, Hollywood, Cricket, India GK, World GK, Science and Sports (at least 40 each) with difficulties. They shall pass the automated content checks in §4.8.
- **R57 (Must)** When a question starts, the system shall show it and its options to all viewers with a timer (default 20 s, range 10–30). Each active player may lock in one answer. The question ends at the deadline or as soon as all active players have answered.
- **R58 (Must)** When a question ends, the system shall reveal the correct option and the answer distribution. A correct answer scores `500 + round(500 × remaining / total)`; a wrong or missing answer scores 0.
- **R59 (Must)** Where team mode is selected, the system shall score each team per question as the average of its members' points.
- **R60 (Must)** When a player taps "Report question" and picks a reason, the system shall store one report per player per question. Once 3 distinct players have reported a question, it shall be excluded from future games.
- **R61 (Must)** The system shall not repeat a question within a room's lifetime while unused questions remain in the selected categories and difficulties.

### 5.12 Game 2: Dumb Charades (Must)

- **R62 (Must)** The system shall bundle at least 200 Bollywood and 200 Hollywood movies with year, era and difficulty, passing the content checks in §4.8.
- **R63 (Must)** When a team's turn starts, the system shall choose the team's next actor in rotation and send only that actor a title matching the selected industries, eras and difficulty. A team timer starts (default 90 s, range 30–180).
- **R64 (Must)** When the actor taps Guessed, the system shall award the team `10 + floor(remaining_s / 10)` points. When the actor taps Pass (default limit 1 per turn), it shall give a new title with the timer still running. If time runs out unguessed, the team scores 0.
- **R65 (Must)** Where the steal rule is on (default off), when a turn times out, the system shall open a 15 s steal window in which the actor marks which other team guessed (or none). That team gets 5 points, and then the title is revealed to all.
- **R66 (Must)** The system shall end Charades after the configured rounds (default 3, with each team acting once per round) and rank teams by score.

### 5.13 Game 3: Draw & Guess (Must)

- **R67 (Must)** The system shall bundle at least 500 drawable words (at least 75 India-specific) with difficulties, passing the content checks in §4.8.
- **R68 (Must)** When a drawing turn starts, the system shall offer only the drawer 3 words. On a choice, the draw timer starts (default 80 s, range 30–120) and the others see only the masked pattern. If no word is chosen within 15 s, then the turn shall be skipped as a missed turn.
- **R69 (Must)** The system shall give the drawer at least 12 colours, 4 brush sizes, an eraser, undo (last stroke) and clear. Strokes shall appear on all phones and the big screen within 1 s at p95. On touch devices, iOS Safari included, drawing on the canvas shall never scroll, zoom or select the page.
- **R70 (Must)** The client shall batch and simplify strokes as in §4.5, with no visible quality loss (Hausdorff distance ≤ 1 unit). A reconnecting or newly joining device shall receive the complete drawing of the current turn.
- **R71 (Must)** When a guesser's message matches the word (case, space and hyphen insensitive), the system shall mark them correct and award `50 + round(250 × remaining / total)`, award the drawer 60 per correct guesser, and show everyone "<name> guessed it!" without the message text.
- **R72 (Must)** When a guess is within edit distance 1 of the word (2 for words of 8+ letters) and not correct, the system shall tell only that guesser "You're close!".
- **R73 (Must)** While the draw timer runs, the system shall reveal hint letters to non-drawers at configured points (default 2 hints, at 50 % and 75 % of the time), never revealing more than half of the letters.
- **R74 (Must)** After a player has guessed correctly, the system shall show their chat messages only to the drawer and other correct guessers. The drawer shall not be able to chat during their turn.
- **R75 (Must)** The turn shall end when the timer expires or all active guessers have guessed, and then the word shall be revealed to all. In each round every seated player draws once (default 2 rounds, range 1–5).

### 5.14 Game 4: Atlas (Must)

- **R76 (Must)** The system shall bundle a server-side place database built from GeoNames (§4.8) with alternate spellings, and shall show "Place data © GeoNames (CC BY 4.0)" in the game and on the About page.
- **R77 (Must)** When a player submits a place on their turn, the system shall accept it only if it matches a database name or alternate spelling (ignoring case, accents, spaces and punctuation), starts with the required letter, fits the selected variant and has not already been used in this game (by place, not by spelling). Rejected attempts show a reason and may be retried before the timer ends.
- **R78 (Must)** The required letter shall be the last letter of the previous place. If no unused place in the variant starts with that letter, then the system shall use the name's previous letter instead, and so on.
- **R79 (Must)** If a submitted name is not in the database, then the system shall pause the turn timer and hold a 10 s accept vote among the other active players. A majority of votes cast accepts it; a tie or no votes rejects it.
- **R80 (Must)** When a player's turn timer (default 20 s, range 10–60) expires, the system shall take one life (default 1, range 1–3). At 0 lives the player is eliminated, and the last player remaining wins. Scoring is +10 per accepted place and +50 for the winner.
- **R81 (Must)** Where a variant is selected (Any place, which is the default; India only; Countries only), the system shall accept only places in that variant.

### 5.15 Game 5: Imposter (Must)

- **R82 (Must)** The system shall bundle at least 150 India-aware word pairs, passing the content checks in §4.8.
- **R83 (Must)** When an Imposter round starts (needs ≥ 4 players), the system shall secretly choose 1 imposter (2 when there are 8+ players and that rule is on). It shall send every player only their own word: the crew word to the crew and the paired word to the imposter. By default the imposter is not told they are the imposter.
- **R84 (Must)** The system shall run the configured number of clue rounds (default 2, range 1–3). Each active player in turn submits one single-word clue (30 s timer), which is visible to all. A clue may not contain the player's own word.
- **R85 (Must)** After the clues, the system shall run a discussion timer (default 60 s, ending early when all active players tap Ready) and then a 30 s vote in which each player votes for one other player.
- **R86 (Must)** When voting ends, the system shall reveal the tally. The most-voted player is accused. On a tie there is one 20 s revote among the tied players; if that also ties, the imposter survives and wins.
- **R87 (Must)** If the accused is the imposter, then the system shall give them one 30 s guess at the crew word. A match (normalised, edit distance ≤ 1 for words of 5+ letters) steals the win. Scoring: crew win +100 for each crew member; +50 to each crew member who voted for the imposter; imposter win +300; imposter steal +200.

### 5.16 Game 6: Most Likely To (Should)

- **R88 (Should)** The system shall bundle at least 150 prompts. In each round all seated players vote for one player (20 s; self-vote off by default). The system then reveals totals dramatically, from lowest to highest over about 5 s, and highlights the winners. Results feed night stats only, not season points.
- **R89 (Should)** The system shall never send or keep who voted for whom. Individual votes are held only until the round's tally is computed, and then only totals remain.

### 5.18 Game 7: Name Place Animal Thing (Must) *(v0.5)*

- **R99 (Must)** When a round starts (needs ≥ 2 players), the system shall show everyone the same random letter (never Q, X or Z, and not repeated within a game) and the categories Name, Place, Animal and Thing, plus Movie when that house rule is on, with a writing timer (default 60 s, range 30–180; default 3 rounds, range 1–10). Each player's answers are visible only to that player until the writing ends, are saved as they type, and count at the deadline. Writing ends early when every active player has tapped Done; an active player who wrote nothing has missed a turn.
- **R100 (Must)** When the writing ends, the system shall group equal answers per category (places by place, so Bombay and Mumbai are one answer). An answer that does not start with the letter scores 0. A Place found in the Atlas place database (R76) is valid without a vote. Every other answer goes to a quick vote (20 s, ending early when everyone taps Looks good) where each player may reject others' answers, not their own; it stays valid unless more than half of the other active players reject it. A valid answer scores 10 when only one player gave it and 5 each when several did.

### 5.17 Delivery

- **R90 (Must)** On every push and pull request, the repository shall run lint, type-check, unit and content tests, the production build and E2E on GitHub Actions (`ubuntu-24.04`). `main` shall stay green and be deployed to Vercel production.

---

## 6. Acceptance criteria

Format: **AC-n [Tag] (R#)**, followed by a pass/fail statement. Unless stated otherwise, E2E runs use test mode (seeded RNG, short timers, local realtime driver) and use 4–8 parallel browser contexts. Bulk players may join through an API helper, and at least 4 contexts in each multi-player test are real browsers.

### 6.1 Identity, rooms and security

- **AC-1 [Unit] (R1)** The name validator accepts `Ravi`, `रवि`, `😎 Bunty`, any rude word and any 1–24-char string after trimming. It rejects `""`, `"   "` and 25+ chars. The codebase contains no word filter.
- **AC-2 [E2E] (R1, R15)** A guest joins with a name. The `huddle_dt` cookie is httpOnly. After a page reload the guest is in the same seat without re-entering the name.
- **AC-3 [E2E] (R2)** Using the test Credentials provider that stands in for Google: user U signs in on context A, joins and scores in a Quiz. Context B (fresh storage) signs in as U and opens the room. B shows U's seat and identical score, and A's view gets the seat-moved notice.
- **AC-4 [Unit] (R3)** Claim merges a guest's `game_results`, `ratings` and crew memberships into the user and marks the guest `merged_into`. A second claim is a no-op. A claim without the guest cookie fails.
- **AC-5 [Unit] (R4)** The token endpoint returns a TokenRequest whose capability is exactly `{"huddle:room:<id>":["subscribe"]}` with TTL ≤ 3 600 000 ms. Unauthenticated requests get 401. Requests for a room the identity has not joined get 403.
- **AC-6 [E2E] (R4)** CI builds with sentinel values for every secret. No file under `.next/static`, no HTTP response body and no realtime frame captured during a full E2E run contains any sentinel.
- **AC-7 [Unit] (R5)** 10 000 generated codes are all 4 letters from the allowed alphabet, with no I, L or O. A forced collision with an active code triggers a retry and returns a different code.
- **AC-8 [E2E] (R5, R6)** Creating a room shows the code, link and QR, and decoding the QR yields the link. A second context that opens the link, and a third that types the code, both reach the join screen. Code `ZZZZ` shows "Room not found" with a Create button.
- **AC-96 [E2E] (R98)** *(v0.5)* The lobby's Share on WhatsApp button (≥ 48 px tall, ≥ 70 % of a phone's width) links to `https://wa.me/?text=…` whose text contains the room code and the join link; the QR code is at least 220 px wide on a phone, with no horizontal scrolling. A phone that joined one room opens a second room's link with its name filled in and joins with one tap; after its cookies are cleared, a third room's link still offers "Join as <name>" and the home page still shows the name.
- **AC-9 [E2E] (R7)** With 12 seated players, a 13th browser is offered only "Watch". The seat count stays 12.
- **AC-10 [Unit] (R8, R45)** A room whose last activity is 24 h 1 min ago returns `ROOM_NOT_FOUND`, and its code can be issued again. Its `games`, `game_results` and `nights` rows remain queryable.
- **AC-11 [E2E] (R9)** A 5th player joins during question 2 of a Quiz. They see the live question and timer but cannot answer. They are seated with 0 points at question 3.
- **AC-12 [E2E] (R10, R24)** The admin kicks player D. D's page shows "Removed by the admin", and D's rejoin by link returns `KICKED`. Other phones show a notice.

### 6.2 Server referee and sync

- **AC-13 [Unit] (R11)** For every game module, table-driven tests send wrong-phase, not-your-turn, malformed and while-paused actions. Each returns the expected code with state deep-equal to before and version unchanged.
- **AC-14 [Unit] (R12)** Against local Postgres: the same `actionId` posted twice is applied once and both responses are identical. 20 concurrent distinct valid actions raise the version by exactly 20. Two concurrent submissions for the same Atlas turn result in exactly one acceptance.
- **AC-15 [Unit] (R13, R35)** The snapshot for viewer X equals `view(state, X)`. The snapshot for an unknown viewer equals the public view. For every game, the public view of a 12-player state is ≤ 16 KB.
- **AC-16 [E2E] (R14)** The test hook drops 3 consecutive `state` messages on one context. Within 1 s that context fetches a snapshot, and its version and rendered scores match the other contexts.
- **AC-17 [E2E] (R15, R18, R70)** In a 4-player Draw turn, guesser B reloads and player C closes the page and reopens the room URL 20 s later. Both are back in the same seat with the same score and team, the countdown is within 1 s of the others, and the full drawing is rendered within 3 s.
- **AC-18 [Unit] (R15)** This is the skribbl regression. For each game, at every phase, a seat leaves and rejoins 5 times. Scores, teams, turn order and night totals are unchanged.
- **AC-19 [E2E] (R15, R16)** A context goes offline for 15 s mid-Quiz and shows "Reconnecting…". Once back online it resyncs within 3 s, its next answer is accepted and its score is intact.
- **AC-20 [E2E] (R16)** One context's realtime transport is blocked entirely. It still follows a 3-question Quiz by polling and answers all 3, and its final scoreboard equals the others'.
- **AC-21 [E2E] (R17)** A fresh context enters the name of a disconnected seat, taps "That's me", and the admin approves. The new context holds that seat and score, and the old context gets "Seat moved to another device".

### 6.3 Timers, AFK, admin, hostless

- **AC-22 [Unit] (R18)** With client clock skew of ±90 s and simulated RTT of 50–400 ms, the offset estimator's displayed remaining time is within 500 ms of the truth.
- **AC-23 [E2E] (R18)** Two contexts whose page clocks are set 60 s apart (Playwright clock) display the same countdown within 1 s.
- **AC-24 [Unit] (R19)** A tick before the deadline is a no-op. A tick after it advances the phase once. 5 parallel ticks with the same `phaseId` produce one transition. A request arriving after 3 overdue turns processes them in order before its own action.
- **AC-25 [Unit] (R20)** When the last human contact was 3 min ago, the next request leaves the game paused with remaining time as of that last contact (minimum 10 s), and no turns are skipped.
- **AC-26 [E2E] (R21, R22, R28)** In a 4-player Draw with short timers and no admin action, D closes their page. D's drawing turns are auto-skipped. After 2 misses D shows the AFK badge and D's next turn is skipped immediately. D's score is unchanged. D reopens and taps "I'm back", and draws in the next round.
- **AC-27 [Unit] (R21)** AFK players do not block early ends: a Quiz question ends when all non-AFK players have answered, and a Draw turn ends when all non-AFK guessers have guessed. An AFK Atlas player loses a life on timeout as normal.
- **AC-28 [Unit] (R23)** Pausing with 37.4 s left and resuming 5 min later sets deadline = resume + 37.4 s. Ticks while paused are no-ops, and actions return `PAUSED`.
- **AC-29 [E2E] (R23, R24)** The admin pauses (every phone shows the overlay and a frozen timer), resumes, skips a turn, ends the game (scoreboard shown) and transfers admin. Each step shows a notice on the other phones. The same actions from a non-admin return `NOT_ADMIN`.
- **AC-30 [Unit] (R25)** Undo twice reverts the last two score events, and totals equal a recomputation from the remaining events. Undo with nothing to undo returns `INVALID`.
- **AC-31 [E2E] (R26)** The admin closes their page. After the grace period (shortened in test mode), the longest-present connected human player sees admin controls and every phone shows "<name> is now admin".
- **AC-32 [Unit] (R27, R29)** Every game's settings schema accepts its defaults, rejects out-of-range values, and rejects changes with `WRONG_PHASE` while a game is running.
- **AC-33 [E2E] (R28, R30)** This is the hostless test. The admin queues Quiz (3 questions) → Draw (1 round), starts it and immediately closes their tab. The other 3 players only play. Both games finish, the scoreboard break appears between them, and the night summary appears at the end.

### 6.4 Queue, teams, ratings

- **AC-34 [E2E] (R29, R30, R31)** A queue of Quiz (5 questions, 15 s timer) → Charades runs with those house rules applied, with a scoreboard break between. Rematch restarts Charades with the same players and identical teams.
- **AC-92 [Unit] (R96)** *(v0.5)* For every player count from 1 to 12, Pick for us only returns games whose minimum is met (none for 1 player; never Charades, Imposter or Most Likely To for 2), never a test-only game, prefers games not already queued or played, and still picks when every fitting game has been.
- **AC-93 [E2E] (R96)** *(v0.5)* Alone in a lobby, Pick for us says at least 2 players are needed and queues nothing. With two players, three taps queue three different games, none needing more than two players, visible on both phones.
- **AC-94 [Unit] (R97)** *(v0.5)* For every game, each preset passes the production settings validation, Normal equals the defaults, each preset is recognised from its settings, and the estimates are whole minutes (≥ 1) that grow from Quick to Normal to Long at 4 and 8 players. Applying a preset keeps categories and other house rules; a hand-picked timer reads as Custom.
- **AC-95 [E2E] (R97)** *(v0.5)* An added Quiz shows Normal with "~3 min" and the three presets with their estimates. Only the admin can change it; tapping Quick updates the other phone to Quick and "~1 min". Advanced shows the settings form, a hand-picked question count shows Custom on both phones, and Long sets 20 questions and the total.
- **AC-35 [Unit] (R32)** Ratings [1400, 1300, 1200, 1100, 1000, 900] in 2 teams give 3 + 3 players with team means within 34 points. 7 players in 3 teams give sizes 3/2/2. The same input always gives the same output.
- **AC-36 [E2E] (R32)** The admin moves a player, shuffles and rebalances. Every phone shows the new teams within 1 s.
- **AC-37 [Unit] (R33)** Two equal 1000-rated players: the winner gets +16 and the loser −16. A 4-player example matches hand-computed deltas to ±0.01, and the deltas sum to 0 (±0.01).

### 6.5 Secrecy

- **AC-38 [Unit] (R34, R35)** Fixtures cover every phase of every game. The serialized public view, and the view for every viewer not entitled to a secret (§4.4), contain none of these strings before their reveal: the quiz answer text or index field, the charades title, the draw word and choices, any imposter word not their own, the imposter seat id, and Most Likely To voter→votee pairs.
- **AC-39 [E2E] (R34, R35)** Run a 4-player session of Quiz, Charades, Draw, Imposter and Most Likely To, recording every HTTP response and realtime message received by each non-entitled context. A search for each secret finds no occurrence before its reveal.

### 6.6 Mobile UX, PWA, demo, persistence

- **AC-40 [E2E] (R37)** At a 360 × 740 viewport, and on iPhone emulation, the home page, lobby, each game's main phase, the leaderboard overlay and the crew page all have `scrollWidth ≤ viewport width`, and every primary button is at least 48 × 48 px. The viewport meta has `viewport-fit=cover`, the app shell pads by `env(safe-area-inset-*)`, and no stylesheet uses a bare `100vh`.
- **AC-88 [E2E] (R69, R37)** *(v0.3)* On WebKit with iPhone emulation, a touch drag on the Draw canvas produces a stroke that the other players receive. During the drag `window.scrollY` and `visualViewport.scale` do not change, and the canvas computes `touch-action: none`.
- **AC-89 [E2E] (R94)** *(v0.4)* Signed out, the home page shows Sign in next to the theme toggle and in the Your crews card, both leading to `/signin`. After signing in, the top shows the user's name and avatar and Sign out; Sign out returns the phone to a guest, and both prompts come back.
- **AC-41 [E2E] (R36)** With no stored preference, the first visit renders the light theme (`data-theme="light"`, page background relative luminance > 0.8), even when the OS prefers dark (emulated). The dark toggle switches themes and survives a reload. axe-core reports zero `color-contrast` violations on the home page, lobby, each game's main phase and the scoreboard, in both themes.
- **AC-83 [Unit] (R36, R91)** *(v0.2)* In the design-token file, every text/background pair in both themes and every game accent with its paired text colour reaches ≥ 4.5:1 contrast (≥ 3:1 for tokens marked large-text or UI). The 12 avatar colours are pairwise distinct (CIEDE2000 ΔE ≥ 15).
- **AC-84 [E2E] (R91)** *(v0.2)* Each game's main phase sets `data-game=<id>`, and its accent resolves to that game's token, with a distinct hue per game *(v0.5: was six)*. In a 12-player lobby every avatar has a unique colour and an emoji, and a player can change their emoji. Avatars appear in the lobby, the scoreboard and the turn indicator.
- **AC-85 [E2E] (R92)** *(v0.2)* At a game end the winner's phone shows confetti and the score change animates. Quiz, Charades and Imposter reveals use the full-screen reveal card. With `prefers-reduced-motion: reduce` emulated, no confetti canvas is created and no running animation (`document.getAnimations()`) lasts more than 150 ms, while the same results are shown.
- **AC-42 [E2E] (R38)** The leaderboard button is visible in every phase of every game. Opening it during a Quiz question shows scores, teams and the countdown, and other players' timers are unaffected. The player can still answer after closing it. In Draw, the overlay auto-closes when that player becomes the drawer, and typed guess text is preserved.
- **AC-43 [E2E] (R39, R40)** Status reads "Your turn" for the turn owner and "Waiting for <name>" for everyone else. A stubbed `navigator.vibrate` is called once with ≤ 200 ms at turn start. With `vibrate` undefined there are no errors. No `<audio>` element or `AudioContext` is ever created.
- **AC-44 [E2E] (R41)** The manifest has a name, 192 and 512 px icons, `display: standalone` and a `start_url`. The page has a 180 px `apple-touch-icon` and the `apple-mobile-web-app-capable` and `apple-mobile-web-app-title` meta tags. A service worker is active. Reloading while offline shows the offline screen.
- **AC-45 [Manual] (R41)** **Required:** on one Android phone, Chrome's **Install app** installs Huddle; it launches full-screen with its icon and can join a room. **If a friend has an iPhone at the playtest:** in Safari, open the app, play one game, then use **Add to Home Screen** and launch it.
- **AC-46 [Unit] (R42)** Each game type *(v0.5: was six)* has How-to-play content with non-empty Rules, Scoring and Timers sections, and the sheet component renders all three.
- **AC-86 [E2E] (R93)** *(v0.2)* `/privacy` loads without sign-in and is linked from the home page footer and the sign-in prompt. It contains the sections What we collect, Why, Who processes it, How long we keep it, and Contact. Contact links to `https://github.com/ShubhamMeghani/huddle/issues`. The page states that there are no ads or trackers.
- **AC-90 [Unit] (R95)** *(v0.5)* Every game has a card with exactly three lines (≤ 80 chars each) and an example. While the card shows, game actions return `WRONG_PHASE`. The first round starts after the last active human's "Got it" (bots and AFK players never block it), at the card's deadline, or on an admin skip, and the game can be ended during the card. A rematch or a later queue entry of the same game shows no card; a different game does. Turning the cards off is admin-only and rejected during a game.
- **AC-91 [E2E] (R95)** *(v0.5)* With the cards on, starting a Quiz shows both phones a card with three lines and an example and no question. After one player's "Got it" the other still sees the card with "1/2 ready"; after the second, both see question 1. A rematch goes straight to question 1.
- **AC-47 [E2E] (R43, R44)** A single browser with no sign-in opens `/demo` and gets a room with 4 bots. Using the game picker, it completes a short round of each of Quiz, Charades, Draw, Atlas, Imposter and Most Likely To, and *(v0.5)* Name Place Animal Thing, and each ends on a scoreboard with non-zero bot activity.
- **AC-48 [Unit] (R45)** Processing a game end writes one `games` row and one `game_results` row per participant (rank, score, placement points, stats). Processing the same end twice writes nothing new.
- **AC-49 [Unit] (R46)** An 11th action within 1 s and a 4th chat message within 2 s return `RATE_LIMITED`.

### 6.7 Crews and rankings

- **AC-50 [E2E] (R47, R48, R51)** A creates a crew and B joins through the invite link. A crew-linked room plays a Quiz and ends the night. The crew history page shows that night with its date, game, winner and awards.
- **AC-51 [Unit] (R49)** The placement-points formula is correct for n = 2, 4 and 7, including ties. Games on 31 Oct 23:59 IST and 1 Nov 00:01 IST land in different seasons. Leaderboard ordering and tie-breaks are correct.
- **AC-52 [Unit] (R50)** From fixture results, per-game stats (played, wins, average rank, accuracy, average drawer points, places named, imposter win rate) and head-to-head records match hand-computed values.
- **AC-53 [Unit] (R52)** A fixture night produces the expected MVP, Best Artist, Fastest Finger, Best Imposter and Most AFK. Awards for unplayed games are omitted. Ties follow §4.7. Most AFK is omitted when nobody went AFK.

### 6.8 Big screen and recap (Should)

- **AC-54 [E2E] (R53)** `GET /api/recap/:roomId/image` returns `image/png`, 1080 × 1350 and < 1 MB. The Share button calls a stubbed `navigator.share` with a file, or downloads when `share` is unavailable.
- **AC-55 [E2E] (R54, R55)** A screen context joins by code and is not listed as a player. The lobby shows the QR. During Draw it shows live strokes, the timer and the leaderboard. After a reload it resyncs within 3 s. Its network log never contains the word before the reveal.

### 6.9 Games

- **AC-56 [Unit] (R56)** The quiz content check passes for all rules in §4.8: ≥ 400 questions and ≥ 40 per category.
- **AC-57 [Unit] (R57, R58, R59, R61)** A correct answer at the start scores 1000 and at the deadline 500, and a wrong answer scores 0. A second lock-in is rejected. The question ends early when all active players have answered. Team score is the members' average. No question repeats in a room until the pool is exhausted.
- **AC-58 [E2E] (R57, R58)** 4 players play 3 seeded questions. Every phone shows the question and the countdown. On reveal the correct option and the distribution appear, and all four scoreboards are identical and match the expected scores (±1 point for timing).
- **AC-59 [Unit] (R60)** A duplicate report from the same player is ignored. After 3 distinct reports the question is never selected again.
- **AC-60 [Unit] (R62)** The movie content check passes: ≥ 200 per industry, unique titles, valid years and eras, and difficulty set.
- **AC-61 [Unit] (R63–R66)** Actor rotation within each team works. Scoring is `10 + floor(rem/10)`. The pass limit is enforced. A timeout scores 0. The steal window gives 5 points to the marked team. The game ends after the configured rounds with teams ranked.
- **AC-62 [E2E] (R63, R64)** In a 2 × 2-team Charades game, only the actor's DOM and network show the title. Pass gives the actor a new title. Guessed updates the team score on all 4 phones and reveals the title to all.
- **AC-63 [Unit] (R67)** The draw-word content check passes: ≥ 500 words, ≥ 75 tagged `india`, unique, valid characters and lengths.
- **AC-64 [Unit] (R70)** Over 200 strokes (synthetic plus recorded fixtures), simplification keeps Hausdorff distance ≤ 1 unit and removes ≥ 40 % of points on average. Every batch is ≤ 8 KB, and encode/decode round-trips exactly.
- **AC-65 [Unit] (R68, R71–R75)** `Auto Rickshaw`, `auto-rickshaw` and `autorickshaw` all match. Close-guess thresholds are 1 and 2. The hint schedule never reveals more than half the letters. Guesser and drawer scoring are correct. The turn ends early when all have guessed. A missing word choice causes a missed turn. Correct guessers' chat is visible only to the drawer and other correct guessers, and drawer chat is rejected.
- **AC-66 [E2E] (R68, R69, R71, R72, R74)** 4 players: the drawer chooses 1 of 3 words and uses a colour, a size, the eraser, undo and clear. The 3 guessers' rendered op logs equal the drawer's within 1 s. A near-miss shows "You're close!" only to that guesser. A correct guess shows "<name> guessed it!" to the others and never the text. The word is revealed at turn end.
- **AC-67 [Unit] (R76)** The places data contains all 193 UN members, 28 states and 8 UTs, and their capitals. `Bombay` resolves to Mumbai, `Bangalore` to Bengaluru, `Calcutta` to Kolkata and `Peking` to Beijing. The attribution text exists in the Atlas UI and on the About page. Running `scripts/build-places.ts` twice on the same input gives byte-identical output.
- **AC-68 [Unit] (R77, R78, R81)** Validation enforces the start letter. `Bombay` after `Mumbai` is rejected as already used. `São Paulo` equals `sao paulo`. The India-only and Countries-only variants reject out-of-variant places. The last-letter fallback applies when no unused place starts with the last letter.
- **AC-69 [Unit] (R79)** An accept vote passes on a majority of votes cast and fails on a tie or no votes. The turn timer is paused during the vote and resumes with the same remaining time.
- **AC-70 [E2E] (R77, R79, R80)** 3 players chain 3 valid places. An unknown name triggers a vote that accepts it. One player's timer expires and they are eliminated. The winner gets +50, and +10 per place is reflected on all scoreboards.
- **AC-71 [Unit] (R82)** The imposter-pair content check passes: ≥ 150 pairs, unique unordered pairs, a ≠ b, and valid hints.
- **AC-72 [Unit] (R83–R87)** Imposter count is 1, or 2 at 8+ players when enabled. Clue validation rejects multi-word clues and clues that contain the player's own word. The vote excludes self. The tie revote runs, and a second tie means the imposter survives. Steal guess matching works. All scoring rules are applied.
- **AC-73 [E2E] (R83–R87)** In a seeded 5-player round, each context shows exactly one word and exactly one context's word differs. Clue rounds, discussion, vote and reveal follow. The caught imposter's correct guess shows "Imposter steals the win" and the scores update.
- **AC-74 [Unit] (R88, R89)** There are ≥ 150 unique prompts. Tallies are correct and the reveal order is ascending. After tallying, neither the room state, the database nor any view contains voter→votee pairs.
- **AC-75 [E2E] (R88, R89)** 4 players vote. The reveal shows totals in ascending order and highlights the winner. No captured network payload contains a voter→votee mapping.

### 6.10 CI, deployment and playtest

- **AC-97 [Unit] (R99, R100)** *(v0.5)* The bot word bank covers every allowed letter. A 10-round game uses 10 different letters, none Q, X or Z. While writing, the public view, the big screen and other players' views never contain a player's answers. `Bengaluru` and `Bangalore` are one valid place shared by two players; an unknown place and other categories go to the vote; a wrong first letter is never voted on and scores 0. An answer stands at 1 rejection of 2 voters and at 2 of 4, and falls at 2 of 3. Own answers can't be rejected, and a rejection can be withdrawn. Unique valid answers score 10 and shared ones 5. Saved drafts count at the deadline, an empty sheet is a missed turn, and nothing to vote on skips the vote. Movie appears only when switched on.
- **AC-98 [E2E] (R99, R100)** *(v0.5)* Three phones see the same letter. While they write, no phone shows or receives another's answers. After everyone taps Done, a place from the database shows as valid without a vote, the author can't reject their own answer, two players reject a made-up Thing, and after Looks good all three phones show it as invalid and the round scores 30 / 30 / 10 (unique 10, shared 5).
- **AC-76 [Deploy] (R90)** The GitHub Actions workflow on `ubuntu-24.04` runs lint, type-check, unit and content tests, build and E2E, and is green on `main`. Vercel production is deployed from `main`.
- **AC-77 [Deploy] (R4, R11)** On production, a client obtains an Ably token from `/api/realtime/token`, subscribes, and receives `state` updates with p95 ≤ 1 s over 50 actions. Test-mode headers and routes have no effect (seeded RNG ignored, test endpoints return 404).
- **AC-78 [Deploy] (R8, R11)** On production with Neon, a room's state survives a redeploy. The first request after 10 min idle (Neon cold start) succeeds in < 5 s.
- **AC-79 [Deploy] (R2)** On production, starting Google sign-in redirects to `accounts.google.com` with the configured client ID and the redirect URI `https://<prod-domain>/api/auth/callback/google`. Google answers with its sign-in page, not an error (`redirect_uri_mismatch`, `invalid_client` or "Access blocked"). A full round trip with a real account is confirmed in AC-82.
- **AC-80 [Deploy] (R11, R15, R18, R69)** 6 real browsers (2 Chromium, 2 Firefox, 2 WebKit) in one production room play 3 Quiz questions and one Draw turn, with one browser reloading mid-turn. All 6 end with identical scoreboards. p95 action→update ≤ 1 s, and stroke p95 ≤ 1 s.
- **AC-81 [Deploy] (R70)** An 80 s continuous drawing turn with 6 viewers and 1 screen keeps stroke publishes ≤ 5/s and every message ≤ 16 KB, with no Ably rate-limit errors. The measured message count, projected to a 3-hour, 8-player night, is ≤ 5 % of the Ably Free monthly quota.
- **AC-87 [Deploy] (R43)** *(v0.2)* On production, a fresh browser with no cookies follows the home-page link to `/demo` and completes a 1-round Quiz against bots in under 2 min.
- **AC-82 [Manual] (R2, R15, R21, R28, R37, R38)** One real playtest with ≥ 4 friends on their own phones covers ≥ 3 games, a deliberate phone lock, a refresh and a Wi-Fi-off rejoin. At least one player signs in with Google on production and sees their profile name. No score is lost and every phone shows the same countdown. Findings are logged in `docs/playtest.md`.

**Coverage:** 98 ACs: 44 Unit, 45 E2E, 7 Deploy and 2 Manual. Every R1–R100 maps to at least one AC.

---

## 7. Phase-1 deployment risks

Phase 1 is a **walking skeleton deployed to production before any game is built**. It covers: home → guest name → create/join room → a trivial "+1" counter action → realtime update on every phone → reload and snapshot restore → Google sign-in. Each risk is first retired on a **local production build** (`next build` + `next start`) against the real Ably app and the Neon `dev` branch, with results in `docs/deploy-checks.md`. The same checks run against production after the owner's first push, which happens once Vercel is imported. Phase 2 does not wait for the production run.

| # | Risk | What can go wrong | Phase-1 proof | Fallback |
|---|---|---|---|---|
| P1-1 | Ably token auth from Vercel | The token route runs on Edge (Ably SDK needs Node). The key is missing from the Production env scope. Tokens are not renewed after 60 min. A capability typo blocks subscribe. | AC-77 run against production, plus a 65-min soak with one tab open that gets renewal with no errors | Snapshot polling (R16) keeps the game playable without realtime. Fix and redeploy. |
| P1-2 | Neon from serverless | A wrong (non-pooled) URL. Connection exhaustion. Cold-start latency. Migrations not applied. | AC-78. `npm run db:migrate` loads env with `node --env-file` (nobody reads the file) and applies `db/migrations` idempotently. | Retries with backoff (safe because of `actionId` idempotency). The lobby warms the DB on load. |
| P1-3 | Google sign-in | The redirect URI does not match the production domain. Missing `AUTH_URL`/`trustHost`. The consent screen is left in "Testing" (only listed users can sign in). | AC-79 with a non-developer Google account | Guests are unaffected, and `/demo` needs no sign-in. The sign-in button only appears when `AUTH_GOOGLE_ID` is configured, so unsetting it hides sign-in until it is fixed. |
| P1-4 | 6 real browsers in one production room | Lost updates under concurrency, version gaps, clock skew, and WebKit or Firefox realtime quirks | AC-80 (counter action in Phase 1; repeated with Quiz and Draw once they exist) | Gap → snapshot rules. If lock contention shows, move per-answer writes to an append table that is merged at reveal. |
| P1-5 | Drawing throughput within Ably Free limits | Too many messages per stroke, oversized messages, rate limits | AC-81 using a synthetic drawer that replays recorded strokes | Raise the flush interval to 300 ms and ε to 1.0. As a last resort, use a turn-scoped token that lets only the drawer publish to `huddle:room:<id>:draw:<turnId>`, with the server persisting strokes at turn end. |

**Budget estimate** (8 players + 1 screen = 9 subscribers, 3-hour night):

| Source | Publishes | Ably messages (×10 incl. inbound) | Function invocations |
|---|---|---|---|
| State updates | ≈ 1 500 | ≈ 15 000 | ≈ 1 500 |
| Strokes (24 turns × 80 s × 5/s) | ≈ 9 600 | ≈ 96 000 | ≈ 9 600 |
| Heartbeats | – | – | ≈ 3 900 |
| Snapshots | – | – | ≈ 3 000 |
| **Per night** | | **≈ 110 000** | **≈ 18 000** |

Ten nights is about 1.1 M Ably messages. That sits well inside the Ably Free monthly allowance, which at the time of writing is about 6 M messages, 200 concurrent connections and 200 channels; Phase 1 records the current figures in `docs/deploy-checks.md`. Invocations are also well inside Vercel Hobby.

---

## 8. Output files

```
SPEC.md                       this document
PLAN.md                       build plan, phase log, AC status table
README.md                     setup, scripts, deploy, data attribution
.env.example                  variable names only, no values
.github/workflows/ci.yml      R90 / AC-76
package.json, tsconfig.json, next.config.ts, eslint config, postcss/tailwind config
vitest.config.ts, playwright.config.ts   (projects: e2e, deploy)
public/manifest.webmanifest, public/icons/*, public/sw.js
db/migrations/NNN_*.sql
content/quiz.json, movies.json, draw-words.json, imposter-pairs.json,
        mlt-prompts.json, bot-drawings.json
data/places.json              generated from GeoNames (CC BY 4.0)
scripts/build-places.ts, check-content.ts, migrate.ts, export-reports.ts
src/app/                      pages: / (home), /r/[code] (room), /demo, /screen,
                              /screen/[code], /c/[invite], /crews/[id], /about, /privacy,
                              /offline; api/** routes from §4.2
src/games/<quiz|charades|draw|atlas|imposter|mlt>/
                              rules.ts, view.ts, settings.ts, bot.ts, howto.ts
src/server/                   db.ts, pipeline.ts (actions/tick), realtime/{ably,local}.ts,
                              auth.ts, identity.ts, crews.ts, stats.ts, awards.ts,
                              ratings.ts, teams.ts, recap.tsx
src/client/                   sync.ts, clock.ts, canvas/, components/, theme/
src/lib/                      normalize.ts, levenshtein.ts, rdp.ts, strokeCodec.ts, rng.ts
tests/unit/**, tests/e2e/**, tests/deploy/**
docs/deploy-checks.md         Phase-1 and Deploy AC results
docs/playtest.md              AC-82 findings
```

---

## 9. Non-goals

- AI features or AI APIs of any kind, including content generation at runtime.
- Voice or video chat.
- Sounds or music (vibration only).
- Native iOS or Android apps and app-store distribution.
- Content moderation: no name or chat filter, no user reporting, no moderation queue. Admin kick is the only tool.
- Public matchmaking or playing with strangers. Rooms are private by code.
- A Hindi or other non-English UI, monetisation, payments or ads.
- Offline gameplay. The PWA caches only the shell and shows an offline screen.
- Anti-cheat beyond server-side validation (for example, peeking at a friend's screen).
- User-made content packs and an in-app content editor.

---

## 10. Risks and fallbacks

| Risk | Likelihood / impact | Mitigation | Fallback |
|---|---|---|---|
| Realtime outage or token issue | Low / High | Subscribe-only tokens; snapshot on every reconnect | 3 s polling (R16). The game stays playable. |
| Ably quota or rate limits from drawing | Medium / Medium | Batching and RDP (§4.5); budget check (AC-81) | Slower flush, a larger ε, or the drawer publishing directly (P1-5) |
| Neon cold start or connection limits | Medium / Low | Pooled URL, short transactions, lobby warm-up | Idempotent retries with backoff |
| Lock contention when 12 players answer at once | Low / Medium | Transactions under 50 ms; strokes kept off the state row | Append-only answers table merged at reveal |
| iOS Safari quirks (PWA storage separate from Safari, background sockets killed, no vibration) | High / Medium | Snapshot on `visible`; vibration feature-detected | Seat reclaim (R17) or Google sign-in restores the seat |
| Phone clock skew | Medium / Low | Server-offset estimation (§4.3) | Server deadlines are always authoritative |
| Claude-written facts are wrong or dated | Medium / Medium | Content checks, no time-relative questions, a 40-question spot check during the playtest | Report button and auto-exclusion at 3 reports (R60) |
| GeoNames misses or misspellings | Medium / Low | Alternate names, normalisation, fallback letter rule | Accept vote (R79); `place_suggestions` logged |
| Google OAuth consent stuck in "Testing" | Medium / Low | Publish the consent screen (basic scopes need no verification) | Guests and `/demo` need no sign-in |
| Flaky multi-context E2E in CI | Medium / Medium | Seeded RNG, short timers, wait-for-version helpers instead of sleeps, traces on failure | `retries: 1` in CI only; shard the E2E job |
| State document growth | Low / Low | Cap notices (10) and chat (50 per turn); scoreEvents cover only the current game | Archive old turns to `room_actions` |
| Celebration animations stutter on low-end phones | Medium / Low | Lightweight canvas confetti with a particle cap; transform/opacity animations only; reduced motion respected (R92) | Replace confetti with a static winner banner |
| 3-day timeline overrun | Medium / High | Build order: platform → Quiz → Draw → Imposter → Atlas → Charades → crews → Should items | Cut in this order: recap card → big screen → Most Likely To → steal rule |

---

## 11. Decisions (formerly open questions)

All v0.1 open questions were resolved on 2026-10-22 by accepting the proposed defaults. The one exception is Q12, which a design change replaced. These decisions are binding for the build. New questions start at Q14.

| # | Question | Decision |
|---|---|---|
| Q1 | How long is a crew season? | Calendar month (IST). Past seasons are browsable. |
| Q2 | Does the imposter know they are the imposter? | No: Undercover style, where the imposter just gets the paired word. A house-rule toggle "Imposter knows" is available. |
| Q3 | Can guest stats be claimed from a different device? | No. Claiming needs the guest cookie on the same device. |
| Q4 | Does creating or joining a crew need Google sign-in? | No. Guests may, with a nudge to sign in so the crew follows them across devices. |
| Q5 | Atlas city population threshold? | World cities ≥ 100 000; Indian cities ≥ 15 000. |
| Q6 | Does Most Likely To count toward season points? | No. Night stats only. |
| Q7 | Quiz: can players change their answer before the deadline? | No. The first lock-in is final. |
| Q8 | Caps on spectators and big screens per room? | 8 spectators and 2 screens. |
| Q9 | Minimum players per game? | Quiz, Draw and Atlas: 2. Most Likely To: 3. Charades: 4 (2 teams of 2). Imposter: 4. *(v0.5)* Name Place Animal Thing: 2. |
| Q10 | Who confirms a Charades guess? | The actor's tap is trusted, and the admin's Undo fixes mistakes. |
| Q11 | How are question reports reviewed? | No review UI. Auto-exclude at 3 reports; `scripts/export-reports.ts` dumps a CSV. |
| Q12 | What is the default theme? | **A bright, light party theme by default, whatever the OS setting.** It has bold game colours, colourful avatars and celebrations, and a dark toggle remembered per device (R36, R91, R92). This replaces v0.1's "dark by default". |
| Q13 | Room lifetime: 24 h from creation or from last activity? | From last activity. |

---

## 12. Changelog

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-10-22 | First draft from the project brief: 90 requirements (84 Must, 6 Should) and 82 acceptance criteria (39 Unit, 35 E2E, 6 Deploy, 2 Manual). |
| v0.2 | 2026-10-22 | Decisions: Q1–Q13 accepted as defaults, except Q12, replaced by a design change.<br>Design: the default theme is now bright and light, with dark as a toggle. R36 rewritten. Added R91 (game colour identities and avatars) and R92 (celebrations that respect reduced motion), AC-41 rewritten, and added AC-83–AC-85.<br>Privacy: added R93 (privacy page, needed to publish Google sign-in) and AC-86.<br>Demo: added AC-87 (production `/demo` check).<br>Sign-in testing: AC-79 is now automatable, and the real Google sign-in moved into the AC-82 playtest. P1-3 now hides sign-in when `AUTH_GOOGLE_ID` is unset.<br>Totals: 93 requirements (87 Must, 6 Should) and 87 ACs (40 Unit, 38 E2E, 7 Deploy, 2 Manual). |
| v0.3 | 2026-10-22 | Delivery: Vercel is Git-connected to the public repo and deploys only on the owner's push; the builder never deploys. Phases are verified on a local production build, and production checks run after a push (§3, §7).<br>iPhone first: every E2E spec also runs on WebKit with iPhone emulation. R37 adds iOS-safe viewport units and safe-area insets, R40 adds silent degradation, R41 adds Safari Add to Home Screen, and R69 rules out page scrolling while drawing. AC-40 and AC-44 extended; added AC-88 (iOS touch drawing). AC-45: Android install required, iPhone check at the playtest if available.<br>Privacy contact is GitHub Issues, not an email (R93, AC-86).<br>Totals: 93 requirements and 88 ACs (40 Unit, 39 E2E, 7 Deploy, 2 Manual). |
| v0.4 | 2026-10-26 | Production: the database layer uses `pg` over TCP with `attachDatabasePool` instead of the Neon WebSocket pool, following Neon's and Vercel's guidance (§3); production checks had shown requests stalling 15–30 s, later traced to the network path between the test machine and Vercel's edge. Client rule: requests time out (catch-ups 10 s, actions 30 s) (§4.2). Added R94 (Sign in at the top of the home page and in the Your crews card; name, avatar and Sign out when signed in) and AC-89. Now 94 requirements (87 Must, 7 Should) and 89 ACs (40 Unit, 40 E2E, 7 Deploy, 2 Manual). |
| v0.5 | 2026-10-27 | Improvements before the friends playtest. Added R95 (a How-to-play card with three lines and an example before a game's first round in a room, skippable, shown once per game per room, admin can turn cards off) with AC-90 and AC-91. Added R96 ("Pick for us": a random game that fits the player count) with AC-92 and AC-93. Added R97 (Quick / Normal / Long presets with estimated minutes, full settings under Advanced) with AC-94 and AC-95. Added R98 (Share on WhatsApp, a large QR code, and a remembered name for one-tap joining) with AC-96. New game Name Place Animal Thing (cyan): R99 and R100 with AC-97 and AC-98, a secret-matrix row, a bot word bank (§4.8) and minimum players (Q9); R91, R44, AC-46, AC-47 and AC-84 now cover every game instead of six. Now 100 requirements (93 Must, 7 Should) and 98 ACs (44 Unit, 45 E2E, 7 Deploy, 2 Manual). |
