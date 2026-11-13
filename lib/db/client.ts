import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "@/lib/env";
import { PrismaClient } from "@/lib/db/generated/client";

/**
 * One client per process, created on first use rather than on import: the
 * module is pulled in during `next build`, where no connection string exists
 * and none is needed.
 *
 * The app connects through the pooled Neon URL because it runs in serverless
 * functions. Migrations use the direct URL, configured in prisma.config.ts.
 */
const globalForPrisma = globalThis as unknown as {
  dowelPrisma: PrismaClient | undefined;
};

export function getPrisma(): PrismaClient {
  const existing = globalForPrisma.dowelPrisma;
  if (existing !== undefined) {
    return existing;
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl() });
  const client = new PrismaClient({ adapter });
  globalForPrisma.dowelPrisma = client;
  return client;
}
