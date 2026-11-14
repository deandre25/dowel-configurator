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

## 2026-11-13 — The error strategy, stated as a rule

The rule, in one line: **a failure the visitor can resolve by changing their
configuration is data; absence is null; anything else is a GraphQL error.**

In full:

1. **Expected failure is data, through a union.** A rule the visitor broke
   comes back as `InvalidConfiguration` in `data`, with the rule code, a
   message written for a person, the cells at fault and the index of the
   module responsible. The response is a success; the answer is "no, and here
   is why".
2. **Absence is null.** A share id that does not exist, and a share id that is
   not well formed, both answer `null`. They are deliberately not
   distinguished — see below.
3. **Everything else is a GraphQL error**, with a `code` in `extensions`. These
   are conditions the visitor cannot fix: a stored row this build cannot read
   or cannot trust, a share id that could not be allocated, a store that has
   reached its ceiling.
4. **Nothing is masked that the visitor could act on**, and nothing is exposed
   that is only meaningful to the server. Yoga masks unexpected throws to
   `INTERNAL_SERVER_ERROR`; every error this project raises deliberately is a
   `GraphQLError` with its own code, so masking never swallows a real answer.

### Every field, audited against the rule

| Field | Expected failure | Absence | Server fault |
| --- | --- | --- | --- |
| `Query.catalogue` | — static data, cannot fail | — | — |
| `Query.configuration(id)` | — | `null` for unknown **and** malformed ids | `UNREADABLE_CONFIGURATION`, `STORED_CONFIGURATION_INVALID` |
| `Query.health` | — | — | none: a database it cannot reach is `database: false`, which is this field's whole job |
| `Mutation.priceConfiguration` | `InvalidConfiguration` | — | — pure computation, nothing to fail |
| `Mutation.saveConfiguration` | `InvalidConfiguration` | — | `SAVE_LIMIT_REACHED`, `ID_ALLOCATION_FAILED` |

Below the schema, at the transport: a malformed body is `BAD_REQUEST` with
status 400, a body over 64 KB is `REQUEST_ENTITY_TOO_LARGE` with 413, and a
query that does not match the schema is `GRAPHQL_VALIDATION_FAILED`. All three
verified by hand against a built server.

### Two places the rule is applied in a way worth defending

**A malformed share id answers null, not an error.** It is arguably something
the visitor can act on — their link is wrong. It is still absence: the answer
to "is there a build at this address" is no, and the shape of the address does
not change that. It also means the endpoint cannot be used to find out which
strings are valid ids, and a malformed id never becomes a database query.

**`SAVE_LIMIT_REACHED` is an error, not a union member**, even though it is
entirely expected. The test is not "did we foresee it" but "can the visitor
resolve it by changing their configuration" — and they cannot. Were it a union
member, every client would have to render a case it can do nothing about.

## 2026-11-13 — saveConfiguration is content-addressed, and bounded

`saveConfiguration` is a public write with no account behind it, against a
0.5 GB free tier. Three things bound it, smallest first:

1. **A 64 KB request body limit.** Yoga's default is 25 MB. The largest legal
   request here — a 30-module configuration plus the query text — is a few
   kilobytes, so anything over 64 KB is not a configuration. Refused with 413
   before it is parsed. Verified: a 168 KB body returns
   `REQUEST_ENTITY_TOO_LARGE`.
2. **A module ceiling**, `TOO_MANY_MODULES`, at one module per bay of the
   largest grid, which is 30. Checked before anything iterates the input, so a
   hostile request cannot cost work proportional to what it chose to send. A
   100,000-module input produces one violation rather than 100,000.
3. **A content hash, unique.** The configuration's canonical form — dimensions,
   finish, modules sorted — is hashed with SHA-256, and that hash is a unique
   index. Saving a build that already exists returns the row that is there.

The hash is the one that matters. It makes a save idempotent, so a script
repeating a request writes nothing, and it bounds the table to **distinct**
configurations rather than to requests. It is also simply the better behaviour:
the same build always has the same link, including when two people assemble it
in a different order.

On top of those there is **an absolute ceiling of 50,000 stored
configurations**, checked only on the path that writes a new row — so saving an
existing build keeps working after the ceiling is reached. A row is a few
hundred bytes, so the ceiling is a few tens of megabytes: well inside the tier,
and far more builds than this will ever hold. It costs one `count()` per new
row.

**What this deliberately is not.** There is no rate limit. A per-instance
counter is meaningless in serverless — each function instance would hold its
own — and a shared counter means a write to Postgres per request, which is a
larger surface than the one it protects. What a rate limit would buy here is
already bought by idempotency and the row ceiling: the cost of abuse is bounded
absolutely rather than per unit time. If this project ever needed real rate
limiting, it would belong at the edge, not in the resolver.

## 2026-11-13 — Prisma 7 with the pg adapter does not report `meta.target`

Asked whether `saveConfiguration` retries on a unique-constraint collision, the
answer was yes — five attempts, then a typed `ID_ALLOCATION_FAILED`, with tests
on both paths. Checking it properly turned up something the tests could not see.

The table now has two unique keys, and they mean opposite things: a duplicate
share id should be retried with a new id, a duplicate content hash means the
build is already saved and its row is the answer. The code distinguished them
by reading Prisma's documented `meta.target`.

**Prisma 7 with the `@prisma/adapter-pg` driver adapter does not set
`meta.target` at all.** Forcing both violations against the real database shows
the constraint arrives as:

```
meta.driverAdapterError.cause.constraint.index = "Configuration_pkey"
meta.driverAdapterError.cause.constraint.index = "Configuration_hash_key"
```

So every collision was classified as a hash collision, and the id-retry path —
which has a passing test, against an in-memory store that raises the exception
the test expects — was dead. It would have worked for as long as 40 bits of
randomness held out, and then failed once, confusingly.

`lib/db/uniqueViolation.ts` now reads the adapter's constraint name, still
reads `meta.target` for the engine path and other adapters, and **returns null
rather than guessing** for a constraint it cannot attribute; the store then
raises with the metadata it was given. `uniqueViolation.test.ts` asserts both
real shapes, captured from the probe rather than invented. Re-verified against
Postgres afterwards: duplicate id classifies as `id`, duplicate hash as `hash`.

The lesson is the same as the previous one, one layer down: a mock raises the
exception you told it to raise. It cannot tell you that the real thing raises
something else.

## 2026-11-13 — "One version installed is not one module instance"

Worth stating on its own, because it is the sentence that would have saved the
time:

> **One version installed is not one module instance.**

A library can be present exactly once in `node_modules` and still be loaded
twice, because package `exports` maps pick a different build per condition —
and `instanceof` across those two builds is false. Where a library uses
`instanceof` to make a decision, as Yoga does to decide whether to mask an
error, that decision silently inverts.

And the resolution, which is the half that matters:

> **Verify against a real build before you touch working code.**

The test was wrong, not the resolver. The only reason that was knowable was
planting a row in Postgres and querying it through `next build && next start`
before changing anything. Had the fix come first, a working error path would
have been "fixed" to match a broken test.

## 2026-11-13 — A check never seen to fail is not known to work

Standing practice, not an incident: **when a gate is added, break the thing it
guards once and confirm it notices.** Recorded here with the observed result,
and extended whenever a gate is added.

| Gate | Broken by | Result |
| --- | --- | --- |
| `tsc --noEmit` | a number assigned to a `string` in `pricing.ts` | exit 2, `error TS2322` naming the line |
| ESLint | a file using `any` and `console.log` | exit 1, 2 errors (`no-explicit-any`, `no-console`) |
| Vitest | rule 1 disabled, so a drawer may sit in the top row | exit 1, 8 tests failed of 115 |
| Generated types | a hand edit to the committed types | exit 1, "differs from a fresh generation" |
| First-load JS budget | the budget lowered to 1 KB | exit 1, "Budget breached: 132.3 KB > 1 KB" |
| Playwright | the landing heading reworded | exit 1, `toBeVisible()` failed |
| Prisma unique-violation classifier | both constraints forced against real Postgres | correct classification, after the probe showed the first implementation was wrong |

Breaking the budget gate also exposed a flaw in the gate's own harness:
`npm run measure:bundle -- --budget-kb 1` was ignored, because the script read
the first `--budget-kb` on the command line and the npm script already supplies
one. It now reads the last, so an override works. A gate you cannot aim is a
gate you cannot test.

Still unverified, and listed so it is not forgotten: the deployed check, which
does not exist until Phase 5. It will be broken once against a deliberately
wrong URL before it is trusted.

## 2026-11-13 — The unit is a pure function, and the renderer only writes matrices

`assembleUnit(configuration)` returns a flat list of parts, each with a
position, a size and a **stable key**. It touches no Three.js type, which means
the design of the product — where every panel goes, how a door covers two bays,
which bay the support stands in — is tested exhaustively without a GPU. Sixteen
tests cover it, including one that feeds it a configuration the rules would
reject.

The renderer's whole job is then to copy those numbers into instance matrices:

- **One geometry per shape.** A 1 × 1 × 1 box and a unit-length rod, shared by
  every mesh. A part's real size is the scale in its matrix.
- **One `InstancedMesh` per part type**, allocated once at `PART_CAPACITY` and
  never reallocated. Changing the configuration writes matrices and sets
  `count`; it does not add, remove or replace anything in the scene graph.
- **Draw calls do not grow with the unit.** A 6 × 5 with 29 modules draws in
  fewer calls than a 5 × 4 with eight, because the count follows the number of
  part *types* used, not the number of parts.

### The capacity test earned its place

`PART_CAPACITY` was first sized to what a *legal* unit can need: a door covers
two bays, so at most 15 of them. The capacity test feeds the assembly inputs
the rules would reject — a door in every bay — and caught that 29 doors would
overflow a buffer sized for 15, which the renderer would have handled by
silently drawing the wrong unit. Capacities are now the module ceiling the
rules enforce, which is 30. Fifteen spare matrices cost nothing; the failure
they prevent is silent.

## 2026-11-13 — Changing the configuration animates by key, not by rebuild

`PartTransition` tracks parts by the keys the assembly produces. Between one
configuration and the next, a key in both is the same part and eases to its new
transform, a key that appears grows in from flat, and a key that goes shrinks
out and is dropped. Nothing is rebuilt and no object is created or destroyed
during a change.

Easing is `1 - e^(-rate · dt)`, so the result does not depend on the frame rate
— a test asserts that stepping at 30 fps and at 144 fps settles to byte-identical
transforms. `prefers-reduced-motion` switches the whole thing to arriving
immediately rather than to a faster animation.

One test runs fifty configuration changes one frame apart and asserts the
tracked set returns to exactly the final assembly, because parts that are never
dropped are a leak into a buffer with a fixed size.

## 2026-11-13 — The shadow, and three attempts at it

The unit has to stand on something. Getting there took three goes, and the
third is the one in the repository.

1. **drei's `ContactShadows` rendered nothing.** Not a faint shadow — nothing,
   at any opacity, blur or distance, on an opaque canvas as well as a
   transparent one, for a plain box as well as for the instanced meshes.
2. **The same technique, written here, also rendered nothing.** Rendering the
   scene from below into a texture with an override material: the floor plane
   drew (verified by forcing it red), the render target worked (verified by
   capturing the main camera's view into it, which produced the unit's
   silhouette), and the orthographic camera under the floor produced an empty
   texture. **I did not find out why**, and saying so is more useful than a
   guess: two camera formulations, `lookAt` and an explicit rotation, both
   produced an empty capture with no error.
3. **Three's shadow mapping, with one light and a `ShadowMaterial` floor.**
   This works, responds to the real geometry, and is what ships. The plane is
   invisible except where the shadow falls on it, so the background still
   belongs to the page.

Percentage-closer filtering gives a shadow whose edge softness is fixed by the
kernel; **variance shadow mapping** takes a blur radius, which is what a shadow
in a room has, so the canvas uses `shadows="variance"` with a radius.

**The directional light is not a retreat to default lighting.** The unit is lit
by the environment map; the light is at a tenth of the intensity that would
require, and it is there to cast a shadow. Pulls do not cast: a 12 mm rod
contributes nothing to a shadow thrown from three metres, and leaving them out
of the shadow pass is two fewer draws.

**What the draw-call counter was telling me the whole time.** Adding a shadow
plane left the count unchanged at 4. A new object in the scene that does not
change the number of draws is not being drawn, and I read past that twice
before using it.

## 2026-11-13 — Fronts are set back from the frame

A drawer front centred on the frame's front face is exactly coplanar with the
board behind it, and a depth buffer cannot separate two surfaces at the same
depth. The first screenshots had horizontal bands flickering across every door.
Fronts are now inset 2 mm — which is also how an inset front is actually made.

## 2026-11-13 — The camera frames a sphere

Two attempts cropped the base of the unit, which cut off the shadow and made it
look as though it were floating: first a fixed multiple of the largest
dimension, then a vertical-extent calculation that forgot the camera's
elevation. The distance now comes from the unit's bounding sphere and the field
of view, `radius / sin(fov / 2)`, which fits whatever the viewport's aspect and
whatever angle the camera is at. A sphere cannot be cropped by an elevation
angle.

## 2026-11-13 — The environment map is a twelfth of its published size

The 3D view downloaded 2.0 MB, of which the 1k HDRI was 1.58 MB — **four times
the weight of all the JavaScript**. The map is never seen: it is filtered into
an irradiance map and a few blurry specular mips, and every surface in the
product is matte.

`scripts/downsample-hdr.ts` decodes Radiance RLE, averages in linear light, and
writes 256 × 128. The file goes from 1577 KB to 128 KB, and the payload from
2.0 MB to 549 KB.

**Checked, not assumed.** The same configuration was rendered with both files
and the two images compared channel by channel: mean difference **0.036 / 255**,
maximum **2 / 255**, and not one channel differing by more than that. The
source and the exact command are in `CREDITS.md` so the reduction can be
reproduced or reversed.

## 2026-11-13 — Headless Chromium has no GPU, and a frame rate has no meaning without its ceiling

Three instrument faults, all found by distrusting a convenient number.

**Headless rasterises WebGL in software.** The first frame-rate run reported
9 fps, and a 4× CPU slowdown barely changed it. The renderer string says why:
headless is `SwiftShader`, headed on this machine is
`ANGLE Metal Renderer: Apple M1`. A frame rate taken headless is a measurement
of SwiftShader. The script now runs headed and **prints the renderer behind
every number it reports**.

**A frame rate without its ceiling is uninterpretable.** The same build
reported 60 fps and then 30 fps on consecutive runs with no code change,
because a headed browser window that is not frontmost has its animation frames
capped. The script now measures the `requestAnimationFrame` ceiling with
nothing being driven and prints it beside every figure, so "30 fps" can be read
as "the ceiling was 30" rather than as a property of the scene.

**A throttle that is not verified may not be applied.** 60 fps under a 4× CPU
slowdown is either headroom or a slowdown that never happened, and the two look
identical. The script times a fixed JavaScript workload before and after
applying the throttle and reports the ratio. The first version's workload ran
in 15 ms and the ratio came back between 2× and 4× on repeated runs — noise
reported as a measurement. At 60 million iterations it is 57 ms against 237 ms,
a measured 4.13× for a requested 4×.

**What survives all of this** is the scene's own work per frame, which no
display cap can hide: 0.1 ms median and under 1 ms worst, even throttled. That
is a property of the code. The frame rate is a property of the machine.

## 2026-11-13 — The measurement hook, and why it is in the page

`?measure=1` installs `window.__dowelMeasurement`, which exposes the renderer's
counters, per-frame timings, and two methods — resize the unit, remount the
canvas. The scripts drive the scene through it.

It is instrumentation, not a control: it is absent unless the page is asked for
with that parameter, nothing in the interface reads it, and it exists because
the numbers this project reports have to come from the real renderer, and until
Phase 4 there are no controls to take them through. It stays afterwards for the
disposal check, which has to mount and unmount the canvas twenty times.

## 2026-11-13 — `/scene` is scaffolding, and says so

The route renders three named example builds, which are the three cases worth
looking at and the three the gate asks for. It is a real page with real copy,
not a dead control, and Phase 4 absorbs it into the configurator. The examples
live in `lib/scene/examples.ts` and a test asserts each one is legal against
the rules rather than trusting the author.

The route is a server component: it validates the configuration before drawing
it, and generates the canvas's text alternative with the same function the API
uses, so the sentence a screen reader hears cannot describe a different unit
from the one drawn.

## 2026-11-13 — Gates broken, second round

Continuing the standing practice. Each new gate broken once, with what it said.

| Gate | Broken by | Result |
| --- | --- | --- |
| Vitest, scene assembly | the centre support no longer produced | 3 of 16 failed |
| Vitest, scene transition | parts that leave never dropped | 2 of 10 failed |
| Playwright, scene route | the canvas's text alternative replaced with "3D view" | exit 1 |
| `measure-scene.ts` | pointed at a route that draws no canvas | threw on the wait for a first frame rather than reporting numbers |
| First-load JS budget | — | re-run after the 3D work: 132.7 KB, nothing 3D in the landing route |

## 2026-11-13 — The sixth lesson, and it is not an instrument fault

The first five were wrong instruments: a HEAD request that skipped gzip, a
manifest missing a chunk, a mock raising the exception it was told to, two
module instances, a frame rate measured on SwiftShader. This one is different,
and it is worth separating because the fix is not better tooling.

> **An object that does not change the number of draws is not being drawn.**

The draw-call counter was correct, was being read correctly, and was printed on
every line of every run. Adding a shadow plane to the scene left it at 4. I
read past that twice — once for drei's `ContactShadows` and once for the
version written here — and spent both attempts theorising about cameras,
blending and transparency instead.

There is no process fix for this. The number was there. The habit it argues
for is to predict what a measurement should do *before* making a change, and
to treat an unchanged number as a result rather than as background.

## 2026-11-13 — The frustum-culling hypothesis, tested and rejected

A good hypothesis for the `ContactShadows` failure: `InstancedMesh` leaves
`boundingSphere` null, so culling falls back to the base geometry's sphere —
one unit cube at the origin, not the whole set — and a camera under the floor
with a tight frustum could cull it.

It is not the cause. Tested by disabling culling on the diagnostic box as well
and computing bounding spheres on the instanced meshes after writing their
matrices: `ContactShadows` still rendered nothing, for either. The instanced
meshes had carried `frustumCulled = false` since the first version in any case.

The entry above stands as unresolved, the shipped shadow stays, and there is
no fourth attempt. Recording a rejected hypothesis is worth the lines: it is
one fewer thing for the next person to try.

## 2026-11-13 — The frame figure measured the wrong half of the pipeline

`performance.now()` around the scene's per-frame work times **the CPU issuing
draw commands**, not the GPU executing them. For eighteen draw calls, 0.1 ms is
submission cost. Reporting it as "the scene's own work per frame" implied a
completeness it did not have.

`EXT_disjoint_timer_query_webgl2` gives the other half. With both:

| Profile | CPU per frame | GPU per frame |
| --- | --- | --- |
| Desktop retina, 4.4 Mpx | 0.10 ms median | **4.06 ms** median, 5.9 ms worst |
| Phone viewport, 2.96 Mpx, 4× CPU | 0.00 ms median | **1.67 ms** median, 1.9 ms worst |

The GPU is doing forty times the work the CPU is, and it scales with pixels,
not with instructions. Against a 16.7 ms budget, 4 ms is a quarter of the frame
on an M1.

**So a 4× CPU slowdown does not simulate a weak GPU, and never did.** The
expense on a phone will be fill rate at dpr 3, the filtered environment map and
the variance shadow map — none of which a CPU throttle touches. The honest
reading of "60 fps under 4× on an M1" is that it says nothing about a
mid-range Android. The M1's 1.67 ms at phone resolution, on a GPU perhaps five
to ten times faster per pixel, is 8–17 ms there: at or past the budget.

**This is measured on one machine and it needs a real device.** The site
deploys at Phase 4; the figures from an actual phone go in the README, with the
device named, and they outrank everything in this table.

### Finding it took a type error TypeScript could not see

The GPU timer reported "unavailable" while a probe in the same page obtained
the extension from the same canvas. The cause was neither: `Stage` never
declared `onGpuSamples`, so it dropped the callback on the way to `Unit`, and
the timer never started. The prop was passed through a spread —
`{...(measuring ? { onFrame, onGpuSamples } : {})}` — and a spread is not
subject to excess-property checking, so the compiler had nothing to say. Two
conditional spreads in a row, each individually reasonable, and a silently
discarded prop between them.

## 2026-11-13 — Occlusion computed from the geometry, not from the depth buffer

The scene was flat because a soft environment lights every face of every box
identically, and the thing it cannot know is that a bay is a box open towards
the viewer.

That is known here, though, so the occlusion is a function of position rather
than a screen-space pass: fragments deeper into the unit are darker, and the
floor takes light from the bottom of the unit. Two `smoothstep`s and a multiply
injected into the material's shader with `onBeforeCompile`.

**It costs nothing measurable.** GPU time per frame went from 4.07 ms to
4.06 ms — inside the noise. SSAO would have been a depth pre-pass, a blur and a
composite for an effect this gets most of, and judging it by frame rate would
have shown nothing either way because the frame rate is capped.

The pulls are left out: they stand proud of the unit and are not in a bay.

## 2026-11-14 — The client holds a configuration and nothing else

`Configurator.tsx` contains no price and no rule. It holds a configuration,
sends it to `priceConfiguration` after every change, and renders the answer:
either a price with its breakdown, or the rules the unit breaks with the bays
they are about. The `InvalidConfiguration` branch is the server's verdict, not
a guess made before asking.

The one piece of domain logic on the client is `lib/configurator/state.ts`,
which decides what a change *means* — placing a door takes the bay above it,
narrowing the unit drops what no longer fits. It is not a second opinion on
legality: it keeps the client from constructing obvious nonsense so that the
server's rejections are the interesting ones. Seventeen tests cover it,
including one that applies two hundred changes in sequence and asserts no two
modules ever claim one bay.

### Staleness is a property of the data, not a flag

The server's answer is stored together with the configuration it answers:

```ts
const [answer, setAnswer] = useState<{ source: Configuration; priced: Priced }>
const pending = answer?.source !== configuration
```

The reducer returns a new object for every change, so an answer is stale
exactly when its `source` is not the configuration on screen. There is no
`setPending(true)` to forget, and the live region cannot announce a price for a
unit the visitor has already changed. Requests also carry a ticket, and a reply
whose ticket is not the latest is dropped — a slow network cannot put an old
price on screen either.

## 2026-11-14 — No client library, and what replaced it

Decided at Gate 1 and now built: graphql-codegen's client preset with
`documentMode: "string"`, and one function.

- Every operation is checked against the SDL at build time, so a mistyped field
  is a build failure rather than a runtime null.
- `request(PriceConfiguration, { input })` returns the type that operation
  returns. The typed client the brief asks for is here; the cache, the
  normalisation and the subscriptions a library would also bring are not,
  because this surface has nothing for them to do.
- A document is its query text, so no part of the `graphql` package reaches the
  browser.

The landing route is 137.9 KB against a 150 KB budget, up 5.2 KB from Phase 3
— the mount button and its loader. The configurator, the client and the entire
3D view are behind one dynamic import.

## 2026-11-14 — The canvas renders on demand

`frameloop="demand"`. Nothing in this scene moves on its own, so a frame is
drawn when the configuration changes, while a change is easing, and while the
camera is being dragged. The transition asks for the next frame itself, for as
long as anything is still moving.

It was found for the wrong reason — four headless browsers running software
WebGL saturated the machine and browser tests timed out on assertions whose
text was already on screen. The contention was the harness's. But the defect it
exposed was real and the phone is where it matters: a unit standing still was
redrawing sixty times a second, indefinitely.

Measured after the change: still 60 fps while orbiting and while resizing, 0
dropped frames. The difference is what happens when the visitor does nothing,
which is now nothing.

## 2026-11-14 — Two markup decisions the tests made for me

**The headline price is labelled.** `£493.10` appears three times on the panel
— the total, the subtotal, and the finish line — and a test matching that text
matched all three. The fix is not a test-only selector: the figure is now
preceded by a screen-reader-only "Total price: ", because reading an amount
aloud with nothing to say which amount it is was ambiguous for a person too.

**The radio inputs are invisible, not clipped.** They were `sr-only`, which is
the usual way to hide an input and style its label. It also puts the control
out of reach of anything that drives a page by pointing at elements — the
browser tests could not check them, and the same is true of some assistive
tooling and of a mistapped finger. They now cover their label at full size with
`opacity-0`, so the hit target is the whole control. Keyboard behaviour,
grouping and announcement are unchanged, because they were never the problem.

In both cases the test failure was a real defect in the interface, found by a
harness that happens to interact with a page the way an unusual visitor does.

## 2026-11-14 — A share link opens the configurator, and needs JavaScript

`/u/<id>` hands the id to the client, which fetches the build through the same
typed query the rest of the interface uses. Following the link is the asking,
so the configurator opens on the saved build rather than waiting for a click.

**The cost, stated plainly:** that page is empty without JavaScript. The
configurator is a client island by the Gate 1 architecture decision, so there
is no version of this that works without it, and server-rendering the restored
build would mean a second path to the same data — either an in-process
`execute` against the schema with a cast at the boundary, or an HTTP call from
the server to itself. Neither is worth a second source of truth for a page
whose entire purpose is an interactive control surface.

An unknown or malformed id is not an error: the server answers null, the page
says the link does not match a saved build, and offers a unit to start from.

## 2026-11-14 — Gates broken, third round

| Gate | Broken by | Result |
| --- | --- | --- |
| Vitest, configurator state | — | 17 new tests; one caught that widening a unit onto the support's bay can empty it, which the server then reports as `EMPTY_UNIT` |
| Generated types | the committed client document tampered with | exit 1, "client/graphql.ts: differs from a fresh generation" |
| Playwright, configurator | — | the suite itself found two interface defects, above |

The generated-types check also had a defect of its own, found when the output
grew a subdirectory: it listed directories as files and died with `EISDIR`
rather than reporting staleness. A gate that crashes is a gate that is not
checking anything.
