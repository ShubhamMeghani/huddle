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
