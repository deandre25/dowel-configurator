import { getPrisma } from "@/lib/db/client";
import type { PrismaClient } from "@/lib/db/generated/client";

/**
 * What every resolver is given. A resolver reaches the database only here.
 *
 * `db` is a function rather than a property on purpose: Yoga assembles the
 * final context by copying this object, which would evaluate a getter — and
 * with it the connection string lookup — on every request, including requests
 * that never touch the database.
 */
export type GraphQLContext = {
  readonly db: () => PrismaClient;
};

export function createContext(): GraphQLContext {
  return { db: getPrisma };
}
