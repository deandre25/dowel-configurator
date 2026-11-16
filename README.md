# Dowel

A 3D configurator for a modular shelving system: assemble a unit from modules
on a grid, change its dimensions and finish, watch the price update, and share
the result as a link that restores the exact build. Three.js front end, GraphQL
API, **pricing and validation on the server**.

**Live:** https://dowel-configurator.vercel.app — browsing, configuring and
pricing all work. Saving and sharing do not yet; see
[Status](#status) for why.

Dowel is a fictional company. This is a demonstration project and nothing here
is for sale.

![The largest unit, six columns by five rows, in charcoal](docs/screenshots/maximum.png)

---

## Status

**Phases 1 to 4 of five are done. Phase 5 is outstanding.** What that means
concretely:

**Done.** The domain and its rules, the GraphQL API with generated types, the
scene, and the configurator: controls, live pricing from the server, validation
shown beside the bay that caused it, and save-and-share. CI runs type checking,
linting, generated-type freshness, 163 unit and integration tests, a build, a
first-load JS budget, and 20 browser tests against a real Postgres.

**Not done — Phase 5.** A bundle analysis pass. Verifying disposal by mounting
and unmounting the canvas twenty times and watching memory return. An axe
accessibility audit. Lighthouse scores: **never measured, so no claim is made
about them anywhere in this file.** A check that runs against the deployed URL
in CI. And this README's final form.

**The deployment is incomplete.** The site is live and the API answers, but the
Vercel project has no database credentials, so `saveConfiguration` and share
links fail. Its own health check says so:

```
{"data":{"health":{"ok":true,"database":false,"schemaVersion":"3"}}}
```

`ok: true, database: false` — the function answered; it cannot reach Postgres.
Adding `DATABASE_URL` and `DIRECT_URL` to the Vercel project fixes it; nothing
in the code needs to change.

**Performance figures come from one machine, an Apple M1.** No real device has
been measured. See [What the numbers do not say](#what-the-numbers-do-not-say).

---

## What is server-authoritative, and why

**The client never computes a price and never decides whether a configuration
is legal.** It holds a configuration, sends it to the server, and renders what
comes back — a price, or the rules the unit breaks with the bays they are
about.

The reason is in the threat model rather than in tidiness: assume the client is
hostile. A mutation carrying an impossible configuration is rejected by the
resolver, not by the interface, so a client that skips the interface entirely
and posts the mutation gets the same answer. There is a test for exactly that.

Validation lives in **one module**, imported by the resolver that prices, the
resolver that saves, and the tests. A saved build is validated **again on
read**: a row could have been written by an older build or edited by hand, and
an impossible unit must not be priced as though it were legal.

An invalid configuration is **not an error**. It arrives in `data` as a union
member carrying the rule code, a message written for a person, the bays at
fault and the index of the module responsible:

```graphql
union PriceConfigurationResult = PricedConfiguration | InvalidConfiguration
union SaveConfigurationResult  = SavedConfiguration | InvalidConfiguration
```

The rule, in one line: **a failure the visitor can resolve by changing their
configuration is data; absence is null; everything else is a typed GraphQL
error.** `DECISIONS.md` audits every field against it.

---

## The product

A unit is a grid: 2 to 6 columns, 2 to 5 rows, in oak, charcoal or white.

| Module | Occupies | Rule |
| --- | --- | --- |
| Open shelf | 1 bay | — |
| Drawer | 1 bay | not in the top row |
| Door | 2 bays, vertically | cannot start in the top row |

A unit over 4 columns wide keeps the centre bay of its bottom row for a centre
support. A unit may not be entirely empty.

Saving is **content-addressed**: the canonical form of a configuration is
hashed, the hash is unique, and saving a build that already exists returns the
link it already has. The same build always has the same link, including when
two people assemble it in a different order.

---

## Stack, and the choices worth explaining

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16, App Router |
| Language | TypeScript `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind 4, theme from CSS custom properties. No component library |
| 3D | React Three Fiber, with the geometry and instancing written against the Three.js API directly |
| GraphQL server | GraphQL Yoga, a route handler in the same app |
| GraphQL client | None — see below |
| Types | graphql-codegen, schema-first, committed and checked for staleness in CI |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | Neon Postgres |
| Tests | Vitest, Playwright |
| CI | GitHub Actions, with a Postgres service container |

### No GraphQL client library

urql with its React bindings is 12–16 KB gzipped and reaches the network
through parsed documents, so it brings `graphql` with it — another 40 KB or so.
Against the remaining first-load budget that was the whole allowance spent
before a single control existed.

The arithmetic only confirmed a decision available on the merits: a client
library earns its weight through a normalised cache, entity sharing across
views, optimistic updates and subscriptions. This application performs three
operations on one view with nothing shared between them and nothing to
invalidate.

What replaced it is graphql-codegen's client preset and one function. Every
operation is checked against the SDL at build time, so a mistyped field is a
build failure; `request(PriceConfiguration, { input })` returns the type that
operation returns. `documentMode: "string"` means a document is its query text,
so **no part of the `graphql` package reaches the browser**.

### The landing route is server-only, with one lazy boundary

The landing route renders as server components. A single dynamic import brings
in the configurator, the GraphQL client and the entire 3D view together, and it
does not begin until the visitor asks.

Decided before any of it was written, because it is a decision about page
composition and retrofitting it means rewriting the page. A visitor who reads
the page and leaves downloads none of it.

### Money is integer pence, and the finish multiplier is basis points

No float touches a price. Prices are integer pence; a finish multiplier is
basis points, where 10000 is ×1, applied **once** to the subtotal rather than
per line — so the whole calculation contains exactly one rounding step.

The catalogue prices were then changed from round numbers to realistic ones,
because with a frame at 18000 and bays at 2200 every subtotal was a multiple of
200, every multiplier divided it exactly, and the rounding step was dead code
no test could distinguish from its absence.

### The canvas is a view of the controls, not the way in

Every configuration action is reachable from a table of bays and three radio
groups — the same controls a keyboard or a screen reader uses. The canvas's
text alternative is `Configuration.description`, a field of the API generated
from the same configuration the geometry is built from, so the sentence a
screen reader hears cannot drift from the unit that is drawn. The same sentence
is the share link's Open Graph description.

---

## Measured numbers

Every figure names the instrument that produced it. Nothing here is estimated.

| Measurement | Value | Instrument |
| --- | --- | --- |
| First-load JS, landing route, gzipped | **137.9 KB**, budget 150 KB | `npm run measure:bundle` — headless Chromium against a production server, summing the response bodies of every script the page actually fetched |
| 3D in the landing route | **none** | the chunks that figure covers are the complete set the route requests |
| Everything the 3D view downloads | **549 KB** (408 KB JavaScript, 128 KB environment map) | `npm run measure:scene-payload` |
| Draw calls — smallest unit | **10** | `WebGLRenderer.info.render`, headed Chromium on ANGLE Metal, Apple M1 |
| Draw calls — doors and drawers | **18** | as above |
| Draw calls — largest unit, 6 × 5, 29 modules | **15**, budget 30 | as above |
| GPU time per frame, desktop retina (4.4 Mpx) | **4.06 ms** median, 5.9 ms worst, against a 16.7 ms budget | `EXT_disjoint_timer_query_webgl2` |
| GPU time per frame, phone viewport (2.96 Mpx) | **1.67 ms** median | as above, on an M1 |
| CPU time per frame | **0.10 ms** median | `performance.now()` — this is the cost of *issuing* a frame, not drawing it |
| Frame rate, orbiting and resizing | **60.0 fps, 0 dropped frames** | counted from rendered frames; the animation-frame ceiling was 60.4 fps, so the scene is at the ceiling |
| Unit and integration tests | **163** | Vitest |
| Browser tests | **20** | Playwright |

The largest unit draws in **fewer** calls than the mixed one, because the count
follows the number of part *types* in use rather than the number of parts. One
`InstancedMesh` per part type is allocated once and never reallocated;
changing the configuration writes instance matrices and does not touch the
scene graph.

### What the numbers do not say

The GPU is doing forty times the work the CPU is, and it scales with pixels. A
CPU throttle therefore **does not** simulate a weak GPU — the expense on a
phone is fill rate, the filtered environment map and the variance shadow map,
and a CPU throttle touches none of them. The same 1.67 ms could be 8–17 ms on a
mid-range Android, which is at or past the frame budget.

Every figure above comes from one Apple M1. **No real device has been
measured.** Numbers from one belong here and would outrank these.

---

## Accessibility bought testability

**No browser test in this repository touches the canvas.** All twenty drive the
table of bays and the radio groups.

That is not incidental. It follows from building the accessible surface first
and treating the 3D view as a view of it, and what it buys is concrete: a 3D
application is tested in CI **with no WebGL at all** — no GPU, no software
rasteriser, no flakiness from a renderer that behaves differently on a build
agent. The canvas is measured separately, on a real GPU, by a script that says
which one. The accessible path is the one under test on every commit, so it
cannot quietly rot.

Two defects in the interface were found by the browser tests, and both fixes
went into the interface rather than the tests:

- The headline price now carries a screen-reader label, because the same figure
  appeared three times on the panel and an amount read aloud with nothing
  saying *which* amount is ambiguous for a person too.
- The radio inputs are invisible rather than clipped. `sr-only` is the standard
  way to hide an input and style its label, and it leaves the control with no
  hit target — out of reach of anything that drives a page by pointing at
  elements, which includes switch access, eye tracking, screen-reader
  click-by-name, and a finger landing a few pixels off.

An axe audit has not been run yet. That is Phase 5.

---

## Running it

Requires Node 22 and a Postgres database. Neon is what this uses, but any
Postgres works.

```sh
nvm use                       # Node 22
npm install                   # also generates the Prisma client
cp .env.example .env.local    # then fill in the two connection strings
npx prisma migrate deploy
npm run dev
```

`DATABASE_URL` is the pooled connection every request uses; `DIRECT_URL` is the
direct one, used only by migrations, because a transaction-mode pooler cannot
carry them. The GraphQL endpoint is at `/api/graphql`.

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run codegen` | Regenerates the GraphQL types from the SDL |
| `npm run codegen:check` | Regenerates into a temporary copy and fails if what is committed differs. Asks nothing of git, so an uncommitted-but-correct file is not reported as stale |
| `npm test` | Vitest: the rules, the pricing table, the id encoding, the configurator's state, and the resolvers through the real schema |
| `npm run test:e2e` | Playwright against a local production build |
| `npm run measure:bundle` | First-load JS, measured in a browser. Fails over 150 KB |
| `npm run measure:scene` | Draw calls, frame rate and the screenshots, on a real GPU. Prints the renderer, the animation-frame ceiling and the measured CPU throttling rate beside every figure |
| `npm run measure:scene-payload` | What the 3D view downloads once it is asked for |

---

## The schema

```graphql
type Query {
  catalogue: Catalogue!
  configuration(id: ID!): SavedConfiguration
  health: Health!
}

type Mutation {
  priceConfiguration(input: ConfigurationInput!): PriceConfigurationResult!
  saveConfiguration(input: ConfigurationInput!): SaveConfigurationResult!
}
```

`lib/graphql/typeDefs.ts` is the SDL as served, with a description on every
type and field.

---

## Decisions

`DECISIONS.md` carries an entry per non-obvious choice, dated, with the
evidence. It includes the mistakes: six instrument faults found during the
build, each one recorded with how it was caught, including two cases where a
test was wrong and the code was right, and one unresolved failure that is
documented as unresolved rather than guessed at.

Third-party assets are credited in `CREDITS.md`. There is one.
