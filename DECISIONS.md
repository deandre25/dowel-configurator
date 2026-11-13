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
