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
