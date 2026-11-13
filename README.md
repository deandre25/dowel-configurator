# Dowel

A 3D configurator for a modular shelving system. The visitor assembles a unit
from modules on a grid, changes its dimensions and finish, watches the price
update, and shares the result as a link that restores the exact build.

Dowel is a fictional company. This is a demonstration project and nothing here
is for sale.

> Phase 2 of five, plus the gate's follow-ups. The domain and the API are done
> and tested; the scene and the configurator follow. This file is finished in Phase 5 with the live link,
> the schema, and the measured numbers.

## What is server-authoritative

The client never computes a price and never decides whether a configuration is
legal. It sends a configuration; the server validates it against the
compatibility rules and returns the price. The rules live in one module, the
resolver imports it, and the resolver's answer is the only one that counts — a
mutation carrying an impossible configuration is rejected there, not in the UI.

## Two details worth naming

**The canvas's text alternative is generated on the server, from the same
configuration the geometry is built from.** `Configuration.description` is a
field of the API, not a string assembled in the component — so the sentence a
screen reader hears cannot drift from the unit that is drawn. It updates
because it is part of the same answer as the price.

**No float touches a price.** Money is integer pence and a finish multiplier is
basis points, where 10000 is ×1, so the arithmetic stays in integers and rounds
exactly once — at the end, on the only division in the calculation. Nothing in
the API carries a rounded decimal, and nothing accumulates an error per module.

## The product

A unit is a grid: 2 to 6 columns, 2 to 5 rows, in oak, charcoal or white. Every
bay holds one module or is left open.

| Module | Occupies | Rule |
| --- | --- | --- |
| Open shelf | 1 bay | — |
| Drawer | 1 bay | not in the top row |
| Door | 2 bays, vertically | cannot start in the top row |

A unit over 4 columns wide keeps the centre bay of its bottom row for a centre
support. A unit may not be entirely empty.

Saving is content-addressed: the canonical form of a configuration is hashed,
the hash is unique, and saving a build that already exists returns the link it
already has. The same build always has the same link, including when two people
assemble it in a different order.

Coordinates count from the bottom left, so row 0 stands on the floor. Prices
are integer pence and finish multipliers are basis points, applied once to the
subtotal, so the whole calculation has one rounding step.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router | The GraphQL server is a route handler in the same app: one deploy, no separate service. |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | Grid indexing is the core of this domain, and unchecked index access is exactly how that goes wrong. |
| Styling | Tailwind 4, theme as CSS custom properties | No component library for the interface chrome. |
| GraphQL server | GraphQL Yoga, route handler at `app/api/graphql` | Fetch-API native, so it runs as a Next route handler unmodified. |
| GraphQL client | None — generated typed documents and a `fetch` wrapper | Three operations, one view, nothing to cache or normalise. A client library would also break the first-load budget twice over. See `DECISIONS.md`. |
| Types | graphql-codegen, schema-first | Types are generated from the SDL and committed; CI fails if they are stale. Documents are emitted as typed strings, so no part of `graphql` reaches the client. |
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
| `npm run codegen:check` | Regenerates into a temporary copy and fails if the committed types differ. Asks no questions of git, so an uncommitted-but-correct file is not reported as stale |
| `npm test` | Vitest: the rules, the pricing table, the id encoding, and the resolvers through the real schema |
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
