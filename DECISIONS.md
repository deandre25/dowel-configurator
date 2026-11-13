# Decisions

One entry per non-obvious choice, newest last. Dated.

## 2026-11-13 — Prisma 7 moves connection strings out of the schema

**Context.** The instruction was to configure the Prisma datasource with
`url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`.

**What happened.** Prisma 7.10 rejects both properties in the schema file:

```
error: The datasource property `url` is no longer supported in schema files.
error: The datasource property `directUrl` is no longer supported in schema files.
```

**Decision.** The intent is kept exactly; only the mechanism moved.

- `prisma.config.ts` sets `datasource.url` to `DIRECT_URL`, so every migrate
  and introspect command uses the direct connection.
- `lib/db/client.ts` constructs the client with `@prisma/adapter-pg` over
  `DATABASE_URL`, the pooled connection, which is what the serverless functions
  use at request time.

Prisma 7 requires a driver adapter for a direct database connection, so one had
to be chosen. `@prisma/adapter-pg` is node-postgres — a plain connection string
and nothing Neon-specific. The Neon CLI, `@neondatabase/serverless` and
`@prisma/adapter-neon` are deliberately absent: no vendor scaffolding in the
repository.

## 2026-11-13 — `prisma`'s `latest` dist-tag is a release candidate

`npm install -D prisma` resolved to `8.0.0-rc.33` while `@prisma/client`
resolved to `7.10.1`, because Prisma currently publishes an RC under `latest`.
A mismatched CLI and client is a subtle failure, so both are pinned to
`7.10.1`.

## 2026-11-13 — First-load JS is measured in a browser, not read from a manifest

Next 16 with Turbopack no longer prints per-route First Load JS in the build
output, and the build manifest is not a reliable stand-in: the landing route
requests a chunk (`1ddde3cit8p2_.js`) that `build-manifest.json` does not list.

`scripts/measure-first-load.ts` therefore loads the route in headless Chromium
against a real `next start` and sums the response bodies of every script the
page actually fetched. Two checks on the instrument itself:

- `next start` does compress: a GET for a chunk returns
  `Content-Encoding: gzip`, 71,753 bytes against 229,289 on disk. A `HEAD`
  request returns no `Content-Encoding`, which is why `curl -I` would have
  given a number nearly 3× too large.
- The reported figure is response bodies only. Response headers are printed
  separately rather than folded into the total.

## 2026-11-13 — System font stack, no web font

The scaffold shipped `next/font/google` with Geist. It is removed. A web font
costs bytes and a network dependency in CI for no gain on an interface that is
chrome around a 3D canvas, and the previous project's defect list already
includes a performance delta that turned out to be a font subset.

## 2026-11-13 — `cacheComponents` off

The Next 16 scaffold enables `cacheComponents` and `partialPrefetching`. Both
are off. The one server surface here is a GraphQL route handler and the
configurator is client-interactive; the extra caching semantics would add
failure modes without buying anything.

## 2026-11-13 — The SDL lives in a TypeScript module

`lib/graphql/typeDefs.ts` holds the SDL in a `/* GraphQL */` tagged template.
It is still schema-first — codegen reads that file as its schema and the
resolvers are typed against the generated `Resolvers` — but it avoids reading a
`.graphql` file from disk inside a serverless function, and avoids a loader for
`.graphql` imports in Turbopack. One source of truth, no build step.

## 2026-11-13 — `any` in generated code, and where it is allowed

Source has no `any`: ESLint fails the build on `@typescript-eslint/no-explicit-any`,
`ban-ts-comment`, `no-non-null-assertion` and `no-console`. The two generated
directories (`lib/graphql/generated`, `lib/db/generated`) are linted-ignored,
because graphql-codegen emits `any` in subscription resolver plumbing this
project does not use and cannot configure away. The claim is "no `any` in
hand-written source", and it is enforced rather than asserted.

## 2026-11-13 — The health query is a real round trip

`Query.health` runs `select 1` through the pooled connection rather than
returning a constant, so the check that will run against the deployed URL can
tell "the function answered" from "the function can reach Postgres". It
reports `ok`, `database` and `schemaVersion` separately for that reason.

## 2026-11-13 — urql over Apollo Client — **superseded the same day, see below**

urql's core is roughly 12–15 KB gzipped against Apollo's 40 KB and up, and the
landing route has a 150 KB first-load budget that is already 132 KB before any
application code. This surface needs two queries and two mutations with no
normalised cache and no cross-view entity sharing, so Apollo's cache would be
weight with nothing to do.

Kept here as the record: the reasoning was right and the conclusion was still
too generous. See "No GraphQL client library at all".

## 2026-11-13 — An ESLint advisory left in place

`npm audit` reports 8 moderate advisories, all from one `minimatch` DoS issue
reached through `@typescript-eslint` under `eslint-config-next`. The offered fix
downgrades `eslint-config-next` from 16.4.6 to 15.5.29, which no longer matches
Next 16. It is a dev-time linter dependency with no production code path, so it
stays until the upstream chain updates.

## 2026-11-13 — A failing error path hides every fault beneath it

**The lesson first, because it generalises.** An error path is not diagnostic
plumbing; it is the only instrument that reports on everything else. When it
fails, it does not fail visibly — it fails by replacing a specific fault with a
generic one, and every defect underneath becomes invisible at the same moment.
So the error path is verified deliberately, by inducing a failure and reading
what comes back, before trusting any report that says a thing went wrong.

Three consequences adopted for the rest of this project:

1. A fault is induced on purpose at least once per surface, and the response is
   read, not assumed. "Errors are handled" is not a claim this project makes
   without a response body to show.
2. Nothing that reports an error may itself be able to throw. Logging,
   serialisation and masking run on the worst input the system has, at the
   moment it is least able to tolerate a second failure.
3. A generic error is treated as an instrument failure until proved otherwise.
   An empty 500 says only that the reporting stopped working; it says nothing
   about the thing that failed, and reasoning from it is reasoning from
   nothing.

**What happened here.** Every GraphQL request that hit an error returned an
empty 500 whose log said only `TypeError: inspect is not a function`, thrown
inside Yoga's error masking. `@whatwg-node/node-fetch` — the ponyfill Yoga
falls back to when no `fetchAPI` is supplied — does
`import { inspect } from "node:util"` in its `Headers` implementation, and
Turbopack's server bundle does not provide that export. The logger threw while
reporting the original error, so the original error was destroyed.

The fault underneath was mine and would have taken a minute to find with a
working error path: the context exposed Prisma through a lazy getter, Yoga
assembles its final context by copying that object, copying evaluates the
getter, and the connection-string lookup therefore ran on every request —
including, in CI, requests where no connection string exists. One ordinary
mistake, made unreadable by a broken reporter.

**Fix.** `app/api/graphql/route.ts` passes Node 22's own `fetch`, `Request`,
`Response` and `Headers` as `fetchAPI`, so the ponyfill never loads. The
context carries `db: () => PrismaClient`, called only by a resolver that needs
a connection.

**Verified, not assumed.** Against a built server: a deliberately throwing
resolver returns
`{"errors":[{"message":"Unexpected error.","extensions":{"code":"INTERNAL_SERVER_ERROR"}}]}`;
an unknown field returns `GRAPHQL_VALIDATION_FAILED`; a malformed body returns
`BAD_REQUEST` with status 400. With `.env.local` moved aside, `health` returns
`{"ok":true,"database":false}` with status 200. The throwing resolver was a
temporary probe and is not in the schema.

**Gap, stated plainly.** The committed guard in `tests/e2e/landing.spec.ts`
exercises the error pipeline through the built server, but not the
*unexpected*-error branch, which is the one that broke — inducing it needs a
resolver that throws, and a permanent one would be a dead control. Phase 2's
integration tests cover resolver behaviour directly, and Phase 5's deployed
check will exercise a real failure. Until then this branch rests on the manual
verification recorded above, and that is the honest status.

## 2026-11-13 — Three defects CI caught that local runs did not

Worth recording, because the brief asks for a fifth wrong instrument and these
are three of its relatives:

1. **Stale generated types.** `useIndexSignature` was removed from
   `codegen.ts` without regenerating, so the committed types still carried
   `Record<string, any>`. The local verification sequence never ran
   `codegen:check`, because at that point there was nothing committed to diff
   against. CI's freshness check found it on the first run.
2. **Step order in CI.** The first-load budget drives headless Chromium, and it
   ran before the step that installs the browser. It failed with Playwright's
   missing-executable message rather than a budget verdict — a check that could
   not have passed or failed honestly.
3. **A leaked server process.** The measurement script killed `npx` rather than
   the `next start` it had spawned, leaving port 3000 held and the browser
   tests failing with "port already used". It now starts the server in its own
   process group and signals the group. Verified by running the measurement
   twice in a row and asserting the port is free after each.

## 2026-11-13 — No GraphQL client library at all

urql with its React bindings is 12–16 KB gzipped, but it reaches the network
through parsed documents and so brings `graphql` with it — another 40 KB or so.
Against 17.7 KB of remaining first-load budget, the client breaks the budget
twice over before a single control exists.

That is the arithmetic, and it only confirms a decision that was already
available on the merits. A client library earns its weight through a normalised
cache, entity sharing across views, optimistic updates and subscriptions. This
application performs three operations — read the catalogue, price a
configuration, save a configuration — on one view, with no entity shared
between them and nothing to invalidate. There is no cache to normalise.

So: graphql-codegen produces typed documents and a thin `fetch` wrapper posts
them to `/api/graphql`. Two details that make this cheaper than it sounds:

- Codegen's `documentMode: "string"` emits `TypedDocumentString` rather than a
  parsed AST literal. The type safety is identical, the document travels over
  the wire as written, and no part of the `graphql` package reaches the client.
  `graphql` stays a server dependency, where Yoga needs it.
- The wrapper is a function with a typed signature, not an abstraction layer:
  one `POST`, `content-type: application/json`, and a typed result. Loading
  state and errors belong to the component that calls it.

This is also the honest answer to a reviewer who asks why there is no client
library: because this surface does not have the problem a client library
solves. The project still demonstrates a typed client — generated types, a
typed document, a typed response — which is what the requirement is actually
about.

## 2026-11-13 — The landing route is server-only, and everything client travels in one lazy boundary

The brief already requires the 3D chunk to load lazily. The same boundary is
moved one level up: the landing route renders as server components only, and a
single dynamic import brings in the configurator UI, the GraphQL wrapper and
the scene together, on interaction.

Decided now rather than in Phase 4, because it is a decision about page
composition and retrofitting it means rewriting the page. Two reasons it is
right beyond the budget:

1. The 132.3 KB already on the landing route is React and the App Router
   runtime; application code is under 1 KB of it. Every client byte added to
   that route is spent before the visitor has asked for the configurator.
2. A visitor who never opens the configurator should pay nothing for it. That
   is the same argument as lazy-loading the canvas, and there is no reason the
   argument stops at the canvas.

What this costs: a mount trigger has to be a client component, so the floor is
not quite zero. Phase 4 measures the island and the lazy chunk separately and
reports both — the budget applies to the first-load figure, and the lazy chunk
is reported next to it rather than hidden behind the fact that it does not
count.

Open question for Phase 5, recorded so it is not forgotten: whether any of the
132.3 KB baseline is reducible at all on an App Router page with no client
components. It will be measured before anything is claimed about it.

## 2026-11-13 — Row 0 is the floor

Coordinates are `column` from the left and `row` from the **bottom**, both
zero-based. The rules are written in terms of the top row and the bottom row,
and "a door spans the top edge" only means something if up is the positive
direction: with row 0 at the top, a door starting in the top row would be the
one placement that is obviously fine.

The accessible control surface will render rows in the opposite order, top
first, because that is how a table reads. That is presentation and it does not
reach the domain.

## 2026-11-13 — Which column the centre support stands in, for even widths

Rule 3 reserves "the middle column of the bottom row". A unit 6 columns wide
has no middle column. `centreSupportColumn` is `Math.floor(width / 2)`: the
true middle for an odd width, and the right-hand one of the two central
columns for an even width.

Arbitrary, but fixed, documented, and known in exactly one place, so the
resolver, the validator, the price, the description and later the geometry
cannot disagree about where the support is.

## 2026-11-13 — An invalid configuration is a result, not an error

`priceConfiguration` and `saveConfiguration` return unions:

```graphql
union PriceConfigurationResult = PricedConfiguration | InvalidConfiguration
union SaveConfigurationResult  = SavedConfiguration | InvalidConfiguration
```

A visitor placing a drawer in the top row has not caused a server error; they
have been told no. It arrives in `data`, with the rule code, a message written
for a person, and the cells at fault, so the interface can render it beside the
offending bay. GraphQL errors are kept for faults in the server — an
unreadable row, an id that cannot be allocated — where there is nothing the
visitor can do.

A violation also carries `moduleIndex`, so the interface can point at the
module the visitor just moved rather than at the cell alone.

## 2026-11-13 — Money is integer pence, and the finish multiplier is basis points

No decimal appears anywhere in pricing. Prices are integer pence; a finish
multiplier is basis points, where 10000 is ×1. The multiplier is applied once,
to the subtotal, rather than per line, so the whole calculation contains
exactly one rounding step.

The prices were then chosen so that rounding actually happens. With round
numbers — a frame at 18000, cells at 2200 — every subtotal was a multiple of
200, every multiplier divided it exactly, and the rounding step was dead code
that no test could distinguish from its absence. The catalogue now reads 17950,
2175, 1395, 4795 and 5595, and `52710 × 1.05 = 55345.5` is in the pricing table
as the half-way case.

## 2026-11-13 — The pricing table is computed outside the implementation

`lib/domain/pricing.test.ts` asserts literal totals that were worked out in a
separate script, not by calling the function under test. A test that recomputes
the expected value the same way the implementation does is a test that agrees
with any arithmetic, including wrong arithmetic.

One test in that file was rewritten for the same reason. It had asserted that a
per-line multiplier would give a different total from a multiplier applied to
the subtotal — and for the configuration it used, the two agreed, so the test
failed. The replacement asserts the formula across every unit size and finish,
and a second test searches for a configuration that distinguishes the two
methods, so the property is established rather than assumed from one sample.

## 2026-11-13 — Every bay is charged, including the one the support stands in

A unit over four columns wide loses its centre bottom bay to a support, and
that bay is still priced. The frame is built for the full grid either way. The
alternative — charging for usable bays — would make a 5-wide unit cheaper than
a 4-wide one at one width, which is not how the thing is manufactured.

## 2026-11-13 — Saved configurations are validated on read as well as on write

`saveConfiguration` validates before it persists, and
`Query.configuration` validates again after it loads. A row could have been
written by an earlier build whose rules were different, or edited by hand. A
configuration that breaks a rule must not be priced as though it were legal, so
the resolver answers with a GraphQL error carrying
`STORED_CONFIGURATION_INVALID` and the codes it broke, rather than a confident
price for an impossible unit.

A row whose `modules` column will not parse is `UNREADABLE_CONFIGURATION` for
the same reason. Both are server faults, not visitor mistakes.

## 2026-11-13 — The resolvers depend on a narrow store, not on PrismaClient

`ConfigurationStore` is two methods: `find` and `create`. Prisma implements it
in `lib/db/prismaConfigurationStore.ts`; the tests implement it in memory.

This is what lets the integration tests run the real schema, the real resolvers
and the real rules with no database, and without casting a `PrismaClient` into
something it is not. It also states what the resolvers need from storage, which
is less than a client gives them.

**The gap it leaves, stated plainly:** an in-memory store cannot prove that
Postgres behaves as expected. Save-then-restore is therefore also run against
Neon by hand at this gate, and will run against the deployed URL in CI in
Phase 5.

## 2026-11-13 — Share ids are random Crockford base32, not sequential

Eight characters of Crockford base32: 40 bits, 1.1 × 10^12 ids. The alphabet
omits I, L, O and U, because these ids get read aloud, typed from a phone
screen and pasted out of chat messages, and 0/O and 1/I are what break that.
`normaliseShareId` folds those confusions and upper-cases, so a mistyped link
still resolves.

Random rather than sequential, so a share link does not disclose how many units
have been saved or let a visitor walk to the next one. A malformed id is a miss,
not an error, and never becomes a database query.

`saveConfiguration` retries five times on a collision and then fails with
`ID_ALLOCATION_FAILED` rather than letting the storage layer's own exception
reach the client.

## 2026-11-13 — The generated-types check no longer asks git

`codegen:check` was `graphql-codegen && git diff --exit-code`. That fails for a
generated file which is correct but not yet committed, which is a check
reporting staleness when nothing is stale — and a check that cries wolf is a
check people stop reading.

`scripts/check-generated.ts` copies the generated directory, regenerates, and
compares the two. It depends on no git state. Verified by tampering with the
committed file and confirming exit code 1, then restoring it and confirming 0 —
a check that has never been seen to fail is not known to work.

## 2026-11-13 — The fourth wrong instrument: one library, two module instances

The integration tests asserted that `Query.configuration` answers
`UNREADABLE_CONFIGURATION` for a row it cannot parse. They got
`INTERNAL_SERVER_ERROR` instead, and the resolver was correct.

graphql 17 ships several builds of itself and chooses between them by export
condition. Vitest resolves the `development` build for the source it transforms
and leaves Yoga external, where Node resolves `index.mjs` — so two module
instances, with two separate `GraphQLError` classes. Yoga decides whether to
mask an error with `error instanceof GraphQLError`, that check was false across
the boundary, and every deliberate, typed error the resolvers raised was
replaced by a generic one. "One version installed" is not the same as one
module instance.

Two things worth keeping from it:

- The fix is one line of Vitest config, pinning `graphql` to the build Node
  resolves. It is in `vitest.config.mts` with the reasoning next to it, because
  the next person to see "Duplicate graphql modules" will not guess.
- **It was a test-environment artefact, and the only way to know that was to
  check.** A planted row in Neon, queried through a real `next build && next
  start`, returns `UNREADABLE_CONFIGURATION` with its code intact — Turbopack
  bundles one copy. Had I trusted the test, I would have "fixed" a working error
  path; had I trusted the fix, I would not have known production was fine.
