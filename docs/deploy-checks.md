# Deploy checks

Results of the Phase-1 risk checks (SPEC §7) and the Deploy acceptance criteria. Entries are appended by
`npm run test:real` (local production build against real Ably and the Neon `dev` branch) and, after the owner
pushes, by `npm run test:deploy` / `npm run probe:draw` against production.

## Ably Free plan limits (recorded 2026-10-22)

Source: <https://ably.com/docs/platform/pricing/limits> (fetched 2026-10-22).

| Limit (Free) | Value |
|---|---|
| Messages per month | 6,000,000 (a publish to N subscribers counts as 1 + N) |
| Account-wide message rate | 500 / s |
| Concurrent connections | 200 |
| Concurrent channels | 200 |
| Max message size | 64 KiB |
| Publish rate per channel | 50 / s |
| Inbound / outbound rate per connection | 50 / s each |
| Token requests | 60,000 / hour, 50 / s |

Huddle's budget: ≤ 5 stroke publishes/s per room (server cap 8/s), batches ≤ 8 KB, one public channel per room.

## Results

### AC-77 realtime · 2026-10-22T18:12:17.733Z · local production build + real Ably + Neon dev

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 2394 ms, p95 2908 ms (budget 6000 ms)

### Six-browser check (@skeleton) · 2026-10-22T18:13:59.566Z · local production build + real Ably + Neon dev

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 57414 ms)

### AC-78 Postgres persistence · 2026-10-22T18:14:12.170Z · local production build + Neon dev (server restarted)

- Room XTUK state and seat restored after restart ✔ (first load 7140 ms)

### Drawing-throughput probe · 2026-10-22T18:16:01.926Z · local production build · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 345 / 344 | – |
| Publishes per second (avg / max) | 4.30 / 7 | ≤ 5 avg; server cap 8 |
| Largest batch | 136 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 1 / 0 | 0 / 0 |
| Deliveries received / expected | 2408 / 2408 | equal |
| Delivery latency p50 / p95 | 1010 ms / 1130 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 82,560 (1.38 % of 6 M) | ≤ 5 % |
| Ably app stats | 2971 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### Drawing-throughput probe · 2026-10-22T18:18:34.313Z · local production build · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 332 / 332 | – |
| Publishes per second (avg / max) | 4.15 / 6 | ≤ 5 avg; server cap 8 |
| Largest batch | 120 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 0 / 0 | 0 / 0 |
| Deliveries received / expected | 2324 / 2324 | equal |
| Delivery latency p50 / p95 | 1028 ms / 1149 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 79,680 (1.33 % of 6 M) | ≤ 5 % |
| Ably app stats | 2684 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### AC-87 demo · 2026-10-23T03:25:41.471Z · local production build

- /demo → Quiz against 4 bots finished in 79 s ✔

### AC-77 realtime · 2026-10-23T03:28:38.636Z · local production build + real Ably + Neon dev

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 2901 ms, p95 2911 ms (budget 6000 ms)

### Six-browser check (@skeleton) · 2026-10-23T03:30:42.706Z · local production build + real Ably + Neon dev

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 76437 ms)

### AC-80 six real browsers · 2026-10-23T03:33:16.850Z · local production build + real Ably + Neon dev

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 4388 ms · stroke → all viewers p95: 5263 ms (budget 6000 ms)

### AC-78 Postgres persistence · 2026-10-23T03:33:32.119Z · local production build + Neon dev (server restarted)

- Room YBNF state and seat restored after restart ✔ (first load 9236 ms)

### Drawing-throughput probe (real Draw turn) · 2026-10-23T03:35:35.051Z · local production build · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 332 / 332 | – |
| Publishes per second (avg / max) | 4.15 / 7 | ≤ 5 avg; server cap 8 |
| Largest batch | 120 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 0 / 0 | 0 / 0 |
| Deliveries received / expected | 2324 / 2324 | equal |
| Delivery latency p50 / p95 | 1064 ms / 1622 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 79,680 (1.33 % of 6 M) | ≤ 5 % |
| Ably app stats | 2547 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### AC-87 demo · 2026-10-25T22:14:54.760Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 89 s ✔

### AC-79 Google redirect · 2026-10-25T22:14:57.912Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-25T22:15:04.217Z · https://playhuddle.vercel.app

- Room BHRP state and seat restored after restart ✔ (first load 1991 ms)

### AC-77 realtime · 2026-10-25T22:15:49.315Z · https://playhuddle.vercel.app

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 847 ms, p95 860 ms (budget 1000 ms)

### Six-browser check (@skeleton) · 2026-10-25T22:16:16.650Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 3421 ms)

### AC-80 six real browsers · 2026-10-25T22:23:46.701Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 1984 ms · stroke → all viewers p95: 1496 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-25T22:29:38.358Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 918 ms · stroke → all viewers p95: 1660 ms (budget 1000 ms)

### Drawing-throughput probe (real Draw turn) · 2026-10-25T22:32:42.474Z · production · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 332 / 332 | – |
| Publishes per second (avg / max) | 4.15 / 8 | ≤ 5 avg; server cap 8 |
| Largest batch | 120 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 0 / 0 | 0 / 0 |
| Deliveries received / expected | 2324 / 2324 | equal |
| Delivery latency p50 / p95 | 325 ms / 413 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 79,680 (1.33 % of 6 M) | ≤ 5 % |
| Ably app stats | 2607 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### AC-80 six real browsers · 2026-10-25T22:34:45.127Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 982 ms · stroke → all viewers p95: 1674 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-25T22:38:39.913Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 920 ms · stroke → all viewers p95: 1582 ms (budget 1000 ms)

## Production summary · 2026-10-26 · https://playhuddle.vercel.app

| Check | Result | Budget |
|---|---|---|
| CI (AC-76) | Run #3 on 37dc613 green: checks, e2e android, e2e iphone, 10 m 39 s | – |
| AC-77 action → other phone | p50 847 ms, p95 860 ms over 50 actions | ≤ 1 s ✔ |
| AC-78 persistence | room and seat restored in a new browser, first load 1991 ms | ✔ (redeploy re-check after the next push) |
| AC-79 Google | redirect with `/api/auth/callback/google`, no error page | ✔ |
| AC-81 strokes (probe) | delivery p50 325 ms, p95 413 ms; 2324/2324 delivered; 0 errors; 1.33 % of the Ably quota per night | ≤ 1 s ✔ |
| AC-87 demo | Quiz against bots finished in 89 s | < 2 min ✔ |
| AC-80 six browsers | **fail**: 6 of 9 runs hit a request stalled 15–30 s (no private refresh for a whole question; an answer and a stroke batch that never landed). When not stalled, action p95 918–920 ms ✔ | ≤ 1 s |

The stroke figures in the AC-80 records above (1582–1674 ms) came from sequential polling with growing gaps and are not delivery times; the test now polls all viewers at once (see PLAN decision log). Cause of the stalls and fix: PLAN decision log, 2026-10-26 (SPEC v0.4). The probe also logged one Ably token request that took over 10 s (a cold start); Ably retried and every message was delivered.

### Local verification of the v0.4 database path · 2026-10-26 · local production build + real Ably + Neon dev

The production branch of `src/server/db.ts` (`pg` over TCP to Neon's pooled endpoint, `attachDatabasePool`, 5 s idle timeout, 30 s connection limit) with the new client timeouts (catch-ups 10 s, actions 30 s):

- AC-77: 50 actions, p50 2915 ms, p95 3416 ms (local budget 6 s) ✔
- AC-78: room and seat restored after a server restart ✔
- AC-80: 3 Quiz questions + 1 Draw turn on 6 browsers, identical scoreboards; action p95 3377 ms, stroke end → all viewers p95 1390 ms; the reloaded phone caught up 5.4 s after the next stroke ✔
- AC-87: demo Quiz finished in 86 s ✔
- @skeleton: 30 concurrent actions from 6 browsers converged in 77 s (75 s on the previous code) ✔
- Probe: 332/332 batches, 2324/2324 deliveries, p50 1141 ms / p95 1341 ms from India ✔

Rejected along the way, each by a failing run here: a 10 s action timeout and a 10 s statement timeout both dropped actions queued on the room's row lock, and a 5 s connection limit with 5 connections did the same. Starting the local server with `VERCEL=1` also slowed the 30-action burst past 180 s regardless of the database settings (other libraries read `VERCEL`), so the branch was checked with the variable unset. Production proof needs the next push: rerun `DEPLOY_URL=https://playhuddle.vercel.app npm run test:deploy`.

### AC-79 Google redirect · 2026-10-26T05:24:01.118Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-26T05:24:07.940Z · https://playhuddle.vercel.app

- Room BTHB state and seat restored after restart ✔ (first load 2002 ms)

### AC-77 realtime · 2026-10-26T05:24:48.020Z · https://playhuddle.vercel.app

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 840 ms, p95 862 ms (budget 1000 ms)

### Six-browser check (@skeleton) · 2026-10-26T05:25:12.784Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 2746 ms)

### Drawing-throughput probe (real Draw turn) · 2026-10-26T05:28:23.021Z · production · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 332 / 332 | – |
| Publishes per second (avg / max) | 4.15 / 6 | ≤ 5 avg; server cap 8 |
| Largest batch | 120 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 0 / 0 | 0 / 0 |
| Deliveries received / expected | 2324 / 2324 | equal |
| Delivery latency p50 / p95 | 305 ms / 377 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 79,680 (1.33 % of 6 M) | ≤ 5 % |
| Ably app stats | 2810 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### AC-87 demo · 2026-10-26T05:39:33.641Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 64 s ✔

### AC-80 quiz half · 2026-10-26T05:46:19.838Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 861 ms (budget 1000 ms)

## Production after d3b505c · 2026-10-26 · https://playhuddle.vercel.app

| Check | Result | Budget |
|---|---|---|
| AC-77 action → other phone | p50 840 ms, p95 862 ms over 50 actions | ≤ 1 s ✔ |
| AC-80 quiz half (6 browsers) | action → other phone p95 861 ms; no stalled request in the 5 runs that reached it | ≤ 1 s ✔ |
| AC-81 stroke delivery (probe) | p50 305 ms, p95 377 ms; 2324/2324; 0 errors | ≤ 1 s ✔ |
| Six-browser skeleton | 30 concurrent actions converged in 2.7 s | ✔ |
| AC-78 across the redeploy | room BHRP, created on the previous deployment, still v4 with 2 waves and seat Neha after d3b505c went live; same-deployment check: state and seat restored, first load 2.0 s | ✔ |
| AC-87 demo | Quiz against bots finished in 64 s (after fixing the test's unbounded click) | < 2 min ✔ |
| AC-79 Google | redirect with the production callback, no error page | ✔ |
| AC-80 Draw half | **fail** in all 5 runs that reached it: the phone that reloads mid-turn misses the last stroke batches (published while its realtime channel was attaching; no later batch reveals the gap). Fixed after d3b505c: every applied snapshot now catches up strokes (SPEC §4.2); needs the next push | – |

Two other runs failed earlier while a phone joined (`room` not shown within 30 s); the next 5 runs joined normally and the cause could not be reproduced.

### AC-87 demo · 2026-10-26T08:28:19.719Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 89 s ✔

### AC-79 Google redirect · 2026-10-26T08:28:22.677Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-26T08:28:29.078Z · https://playhuddle.vercel.app

- Room QFSN state and seat restored after restart ✔ (first load 2025 ms)

### Six-browser check (@skeleton) · 2026-10-26T08:29:33.425Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 2457 ms)

### AC-80 quiz half · 2026-10-26T08:30:20.244Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 862 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-26T08:30:28.678Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 862 ms · stroke end → all viewers p95: 867 ms (budget 1000 ms) · reloaded phone caught up 1279 ms after the next stroke

### Drawing-throughput probe (real Draw turn) · 2026-10-26T08:32:10.938Z · production · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 332 / 332 | – |
| Publishes per second (avg / max) | 4.15 / 5 | ≤ 5 avg; server cap 8 |
| Largest batch | 120 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 0 / 0 | 0 / 0 |
| Deliveries received / expected | 2324 / 2324 | equal |
| Delivery latency p50 / p95 | 320 ms / 364 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 79,680 (1.33 % of 6 M) | ≤ 5 % |
| Ably app stats | 2860 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### AC-77 realtime · 2026-10-26T08:49:53.623Z · https://playhuddle.vercel.app

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 854 ms, p95 868 ms (budget 1000 ms)

## Production after 42c8598 · 2026-10-26 · https://playhuddle.vercel.app

| Check | Result | Budget |
|---|---|---|
| AC-77 action → other phone | p50 854 ms, p95 868 ms over 50 actions (rerun; the first run failed, see below) | ≤ 1 s ✔ |
| AC-80 six browsers | **pass**: 3 Quiz questions + 1 Draw turn, one reload mid-turn, identical scoreboards; action p95 862 ms, stroke end → all viewers p95 867 ms; the reloaded phone caught up 1.3 s after the next stroke | ≤ 1 s ✔ |
| AC-81 stroke delivery (probe) | p50 320 ms, p95 364 ms; 2324/2324; 0 errors | ≤ 1 s ✔ |
| AC-78 | state and seat restored, first load 2.0 s; across a redeploy: room BHRP (above) | ✔ |
| AC-79, AC-87, skeleton | pass (demo Quiz 89 s; 30 concurrent actions converged in 2.5 s) | ✔ |
| CI (AC-76) | run #5 on 42c8598 green: checks 1.1 min, e2e android 9.9 min, e2e iphone 11.5 min | ✔ |

**The intermittent 15–30 s stalls are on the network path from the test machine to Vercel's edge, not in the app.** The first AC-77 run failed when one tap's request hung; a probe from the same machine then showed every request on one connection to Vercel failing together after 19.2 s (the Windows TCP retransmission limit), three times in 4 minutes, including `/manifest.webmanifest`, a static CDN file that runs no function and touches no database. In a second probe `nextjs.org`, another Vercel-hosted site, stalled the same way, while `www.google.com` never did. This also explains the stalls seen before d3b505c. The client timeouts (d3b505c) and the snapshot stroke catch-up (42c8598) are what let a phone recover from such a connection.

### AC-87 demo · 2026-10-27T03:07:30.886Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 68 s ✔

### AC-79 Google redirect · 2026-10-27T03:07:34.144Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-27T03:07:40.705Z · https://playhuddle.vercel.app

- Room EQEK state and seat restored after restart ✔ (first load 2063 ms)

### AC-77 realtime · 2026-10-27T03:08:28.229Z · https://playhuddle.vercel.app

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 858 ms, p95 875 ms (budget 1000 ms)

### Six-browser check (@skeleton) · 2026-10-27T03:15:02.111Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 2745 ms)

### AC-80 quiz half · 2026-10-27T03:15:47.675Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 853 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-27T03:15:56.383Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 853 ms · stroke end → all viewers p95: 1036 ms (budget 1000 ms) · reloaded phone caught up 1179 ms after the next stroke

### AC-80 quiz half · 2026-10-27T03:17:02.867Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 855 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-27T03:17:11.454Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 855 ms · stroke end → all viewers p95: 838 ms (budget 1000 ms) · reloaded phone caught up 1169 ms after the next stroke

### Drawing-throughput probe (real Draw turn) · 2026-10-27T03:19:24.052Z · production · driver ably

| Metric | Value | Budget |
|---|---|---|
| Batches posted / accepted | 332 / 332 | – |
| Publishes per second (avg / max) | 4.15 / 5 | ≤ 5 avg; server cap 8 |
| Largest batch | 120 B | ≤ 8 KB (Ably max 64 KiB) |
| Rate-limited (429) / other errors | 0 / 0 | 0 / 0 |
| Deliveries received / expected | 2324 / 2324 | equal |
| Delivery latency p50 / p95 | 315 ms / 356 ms | p95 ≤ 1000 ms on production |
| Projected Ably messages per 3 h, 8-player night | ≈ 79,680 (1.33 % of 6 M) | ≤ 5 % |
| Ably app stats | 2648 messages in the last 3 minutes (app stats; stats lag ~1 min) | – |

### AC-87 demo · 2026-10-27T03:50:10.900Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 78 s ✔

### AC-79 Google redirect · 2026-10-27T03:50:13.514Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-27T03:50:19.626Z · https://playhuddle.vercel.app

- Room XKPY state and seat restored after restart ✔ (first load 1942 ms)

### Six-browser check (@skeleton) · 2026-10-27T03:51:31.027Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 2628 ms)

### AC-80 quiz half · 2026-10-27T03:52:13.963Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 828 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-27T03:52:22.192Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 828 ms · stroke end → all viewers p95: 1215 ms (budget 1000 ms) · reloaded phone caught up 1232 ms after the next stroke

### AC-87 demo · 2026-10-27T03:53:49.362Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 62 s ✔

### AC-79 Google redirect · 2026-10-27T03:53:52.200Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-27T03:53:58.595Z · https://playhuddle.vercel.app

- Room NWUU state and seat restored after restart ✔ (first load 2068 ms)

### AC-77 realtime · 2026-10-27T03:54:39.781Z · https://playhuddle.vercel.app

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 837 ms, p95 870 ms (budget 1000 ms)

### Six-browser check (@skeleton) · 2026-10-27T03:55:03.823Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 2598 ms)

### AC-80 quiz half · 2026-10-27T03:59:02.313Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 847 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-27T03:59:10.222Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 847 ms · stroke end → all viewers p95: 866 ms (budget 1000 ms) · reloaded phone caught up 1211 ms after the next stroke

### AC-87 demo · 2026-10-27T05:24:27.471Z · https://playhuddle.vercel.app

- /demo → Quiz against 4 bots finished in 70 s ✔

### AC-79 Google redirect · 2026-10-27T05:24:30.740Z · https://playhuddle.vercel.app

- Redirect to Google with callback https://playhuddle.vercel.app/api/auth/callback/google and no error page ✔

### AC-78 Postgres persistence · 2026-10-27T05:24:37.132Z · https://playhuddle.vercel.app

- Room UGAK state and seat restored after restart ✔ (first load 2033 ms)

### AC-77 realtime · 2026-10-27T05:25:17.718Z · https://playhuddle.vercel.app

- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔
- Action → other phone update over 50 actions: p50 842 ms, p95 860 ms (budget 1000 ms)

### Six-browser check (@skeleton) · 2026-10-27T05:25:42.207Z · https://playhuddle.vercel.app

- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version 37 ✔ (converged in 2594 ms)

### AC-80 quiz half · 2026-10-27T05:26:27.069Z · https://playhuddle.vercel.app

- 3 Quiz questions on 6 browsers: every answer seen by another phone; action → other phone p95 832 ms (budget 1000 ms)

### AC-80 six real browsers · 2026-10-27T05:26:34.708Z · https://playhuddle.vercel.app

- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔
- Action → other phone p95: 832 ms · stroke end → all viewers p95: 1355 ms (budget 1000 ms) · reloaded phone caught up 1191 ms after the next stroke
