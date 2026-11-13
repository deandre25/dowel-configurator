import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Local development keeps its connection strings in .env.local; on Vercel and
// in CI they arrive as real environment variables.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Migrations run over the direct connection. The Neon pooler sits in front of
// Postgres as PgBouncer in transaction mode, which cannot carry the advisory
// locks and session-level DDL state that migrations need.
//
// The datasource is omitted when DIRECT_URL is absent so that `prisma generate`
// still works in CI, where nothing connects to a database. A migrate command
// without it fails with Prisma's own message about the missing datasource,
// which is the loud failure we want rather than a connection to nowhere.
const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(directUrl === undefined ? {} : { datasource: { url: directUrl } }),
});
