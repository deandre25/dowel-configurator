import type { Resolvers } from "@/lib/graphql/generated/types";
import { SCHEMA_VERSION } from "@/lib/graphql/version";

export const resolvers: Resolvers = {
  Query: {
    health: async (_parent, _args, context) => {
      // A real round trip, not a constant: the check that runs against the
      // deployed URL needs to tell "the function answered" from "the function
      // can reach Postgres".
      let database = false;
      try {
        await context.db().$queryRaw`select 1`;
        database = true;
      } catch {
        database = false;
      }
      return { ok: true, database, schemaVersion: SCHEMA_VERSION };
    },
  },
};
