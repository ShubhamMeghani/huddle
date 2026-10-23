# Huddle

Game night for your crew. Party games for Indian friend groups where **everyone plays on their own phone**, with an
optional big screen. The server is the referee, so a phone that locks, refreshes or drops Wi-Fi rejoins with the
**same seat, score and countdown**.

- **Try it alone:** open `/demo` for a room with four bots. Every game is playable solo.
- Specification: [SPEC.md](SPEC.md) · Build plan, decisions and AC status: [PLAN.md](PLAN.md) · Deploy checks: [docs/deploy-checks.md](docs/deploy-checks.md)

## Games

| Game | In short |
|---|---|
| ⚡ Quiz Clash | 439 original questions (Bollywood, Hollywood, cricket, India GK, world GK, science, sports); speed bonus; solo or teams |
| 🎨 Draw & Guess | 592 India-aware words; live drawing; hints; private "you're close!" |
| 🕵️ Imposter | 186 word pairs; one-word clues, vote, and a steal guess for a caught imposter |
| 🌍 Atlas | Last letter → first letter, validated against 9,766 GeoNames places, with an accept vote for unknown places |
| 🎭 Dumb Charades | 521 Bollywood and Hollywood movies by era; only the actor sees the title |
| 👀 Most Likely To | 159 prompts; anonymous votes; dramatic reveal |

Around the games: crews with IST-month seasons, stats, head-to-head and history; end-of-night awards and a shareable
recap card; Elo-balanced teams; admin controls with automatic hand-off; AFK handling; a big-screen mode (`/screen`);
an installable PWA; a bright light theme with a dark toggle.

## How it works

- Every action goes to an API route that validates it with a pure game module, saves the versioned room state in
  Postgres (row lock and idempotent action IDs), and only then publishes the public view over Ably.
- Secrets (answers, titles, words, votes) never travel over Ably. A phone fetches its private view over HTTPS
  when it is told its private part changed.
- Timers are server deadlines. Any phone (or bot schedule) wakes the server when a deadline passes; catch-up replays
  overdue deadlines in order, and a room that has been silent for 2 minutes pauses instead of fast-forwarding.
- A phone that misses messages detects the version gap and fetches a fresh snapshot. If realtime is down it polls
  every 3 s.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in values yourself; never commit or share them
npm run db:migrate           # applies db/migrations to DATABASE_URL
npm run dev
```

Content is generated from the sources in `content/src` (`npm run build:content`), places from GeoNames
(`npx tsx scripts/build-places.ts`) and icons from `scripts/make-icons.ts`.

## Tests

| Command | What |
|---|---|
| `npm test` | Unit, content and DB tests against a throwaway Postgres |
| `npm run test:e2e` | Multi-player E2E on Android (Chromium) and iPhone (WebKit) emulation, local production build |
| `npm run test:real` | Local production build against real Ably and Neon `dev` (six browsers, restart, probe) |
| `DEPLOY_URL=https://… npm run test:deploy` | Checks against production |
| `npm run ci` | Everything CI runs |

## Attribution

Atlas place data © [GeoNames](https://www.geonames.org/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Questions, movie lists, words, word pairs and prompts are original to this project.
