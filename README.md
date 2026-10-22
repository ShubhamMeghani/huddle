# Huddle

Game night for your crew. Party games for Indian friend groups where everyone plays on their own phone, with an
optional big screen. The server is the referee, so a phone that locks, refreshes or drops Wi-Fi rejoins with the
same seat, score and countdown.

- Specification: [SPEC.md](SPEC.md) · Build plan and status: [PLAN.md](PLAN.md) · Deploy checks: [docs/deploy-checks.md](docs/deploy-checks.md)
- Stack: Next.js (App Router, TypeScript) · Tailwind · Neon Postgres · Ably · Auth.js (optional Google) · Vitest · Playwright · Vercel

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in values yourself; never commit or share them
npm run db:migrate           # applies db/migrations to DATABASE_URL
npm run dev
```

## Tests

| Command | What |
|---|---|
| `npm test` | Unit, content and DB tests against a throwaway Postgres |
| `npm run test:e2e` | Multi-player E2E on Android (Chromium) and iPhone (WebKit) emulation, local production build |
| `npm run test:real` | Local production build against real Ably and Neon `dev` |
| `DEPLOY_URL=https://… npm run test:deploy` | Checks against production |
| `npm run ci` | Everything CI runs |

## Attribution

Place data for Atlas © [GeoNames](https://www.geonames.org/), licensed under CC BY 4.0.
