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

## 2026-11-13 — urql over Apollo Client

urql's core is roughly 12–15 KB gzipped against Apollo's 40 KB and up, and the
landing route has a 150 KB first-load budget that is already 132 KB before any
application code. This surface needs two queries and two mutations with no
normalised cache and no cross-view entity sharing, so Apollo's cache would be
weight with nothing to do.

## 2026-11-13 — An ESLint advisory left in place

`npm audit` reports 8 moderate advisories, all from one `minimatch` DoS issue
reached through `@typescript-eslint` under `eslint-config-next`. The offered fix
downgrades `eslint-config-next` from 16.4.6 to 15.5.29, which no longer matches
Next 16. It is a dev-time linter dependency with no production code path, so it
stays until the upstream chain updates.

## 2026-11-13 — Yoga is handed Node's own Fetch API, not the ponyfill

**Symptom.** In CI, every GraphQL request that hit an error returned an empty
500. The server log said only:

```
TypeError: inspect is not a function
    at rD.error (...)
    at Object.maskError (...)
```

**Cause.** `@whatwg-node/node-fetch`, which Yoga falls back to when no
`fetchAPI` is supplied, does `import { inspect } from "node:util"` in its
`Headers` implementation. Turbopack's server bundle does not provide that
export, so Yoga's logger threw while reporting the original error and the real
error was lost behind a broken 500.

**Fix.** `app/api/graphql/route.ts` passes Node 22's own `fetch`, `Request`,
`Response`, `Headers` and friends as `fetchAPI`, so the ponyfill is never
loaded.

**Verified** against a built server (`next build && next start`): a resolver
that throws now returns `{"errors":[{"message":"Unexpected error.",
"extensions":{"code":"INTERNAL_SERVER_ERROR"}}]}`, and an unknown field
returns `GRAPHQL_VALIDATION_FAILED`. The throwing resolver was a temporary
probe and is not in the schema.

**Gap, stated plainly.** The committed guard
(`tests/e2e/landing.spec.ts`, malformed JSON body) exercises the error pipeline
through the built server, but not the *unexpected*-error branch, which is the
one that broke: inducing it requires a resolver that throws, and a deliberate
one would be a dead control. Phase 2's integration tests cover the resolver
behaviour, and this entry records that the bundling branch is covered by
manual verification until a real failure path exists to assert on.

## 2026-11-13 — The context exposes `db()`, not a `prisma` property

The first version gave the context a lazy getter so that a request which never
touches the database would not require `DATABASE_URL`. Yoga assembles its final
context by copying the object, which evaluates the getter — so the connection
string was read on every request after all, and in CI, where no connection
string exists, that threw before the resolver's own error handling could see
it. The context now carries `db: () => PrismaClient`, which is only called by a
resolver that actually needs a connection. Verified by running the built server
with `.env.local` moved aside: `health` returns
`{"ok":true,"database":false}` with status 200.

## 2026-11-13 — Two defects CI caught that local runs did not

Worth recording, because the brief asks for a fifth wrong instrument and these
are two of its relatives:

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
