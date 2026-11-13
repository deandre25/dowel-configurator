import { getPrisma } from "@/lib/db/client";
import type { PrismaClient } from "@/lib/db/generated/client";

/** What every resolver is given. A resolver reaches the database only here. */
export type GraphQLContext = {
  readonly prisma: PrismaClient;
};

export function createContext(): GraphQLContext {
  // A getter, so a request that never touches the database never opens a
  // connection and never requires DATABASE_URL to be present.
  return {
    get prisma() {
      return getPrisma();
    },
  };
}
