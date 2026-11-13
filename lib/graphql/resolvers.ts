import type { Resolvers } from "@/lib/graphql/generated/types";
import { SCHEMA_VERSION } from "@/lib/graphql/version";

export const resolvers: Resolvers = {
  Query: {
    health: async (_parent, _args, context) => {
      // A real round trip, not a constant: the deployed check needs to know
      // whether the function can reach Postgres through the pooler.
      let database = false;
      try {
        await context.prisma.$queryRaw`select 1`;
        database = true;
      } catch {
        database = false;
      }
      return { ok: true, database, schemaVersion: SCHEMA_VERSION };
    },
  },
};
