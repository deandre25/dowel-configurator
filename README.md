# Dowel

A 3D configurator for a modular shelving system. The visitor assembles a unit
from modules on a grid, changes its dimensions and finish, watches the price
update, and shares the result as a link that restores the exact build.

Dowel is a fictional company. This is a demonstration project and nothing here
is for sale.

> Phase 1 of five. The foundation is in place; the domain, the scene and the
> configurator follow. This file is finished in Phase 5 with the live link, the
> schema, and the measured numbers.

## What is server-authoritative

The client never computes a price and never decides whether a configuration is
legal. It sends a configuration; the server validates it against the
compatibility rules and returns the price. The rules live in one module, the
resolver imports it, and the resolver's answer is the only one that counts — a
mutation carrying an impossible configuration is rejected there, not in the UI.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router | The GraphQL server is a route handler in the same app: one deploy, no separate service. |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | Grid indexing is the core of this domain, and unchecked index access is exactly how that goes wrong. |
| Styling | Tailwind 4, theme as CSS custom properties | No component library for the interface chrome. |
| GraphQL server | GraphQL Yoga, route handler at `app/api/graphql` | Fetch-API native, so it runs as a Next route handler unmodified. |
| GraphQL client | urql | Lighter core than Apollo for a surface with no normalised cache to use. See `DECISIONS.md`. |
| Types | graphql-codegen, schema-first | Types are generated from the SDL and committed; CI fails if they are stale. |
| ORM | Prisma 7 with `@prisma/adapter-pg` | Plain connection strings. Pooled for requests, direct for migrations. |
| Database | Neon Postgres | |
| Unit tests | Vitest | |
| Browser tests | Playwright | |
| CI | GitHub Actions | Type check, lint, generated-types freshness, unit, build, bundle budget, browser tests. |
| Deploy | Vercel | |

## Running it

```sh
nvm use                 # Node 22
npm install             # also generates the Prisma client
cp .env.example .env.local   # then fill in the two Neon connection strings
npx prisma migrate deploy
npm run dev
```

The GraphQL endpoint is at `/api/graphql`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run codegen` | Regenerates `lib/graphql/generated` from the SDL |
| `npm run codegen:check` | Regenerates, then fails if the result differs from what is committed |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright against a local production build |
| `npm run measure:bundle` | Starts `next start`, loads the landing route in headless Chromium, and sums the gzipped bodies of every script it fetched. Fails over 150 KB. |

## Measured numbers

Filled in as each phase produces them. Every figure names the instrument that
produced it.

| Measurement | Value | Instrument | Date |
| --- | --- | --- | --- |
| First-load JS, landing route, gzipped | 132.3 KB | `npm run measure:bundle` (headless Chromium against `next start`) | 2026-11-13 |

## Decisions

`DECISIONS.md` carries one entry per non-obvious choice, dated.
