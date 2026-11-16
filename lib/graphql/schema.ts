import { createSchema } from "graphql-yoga";
import type { GraphQLContext } from "@/lib/graphql/context";
import { resolvers } from "@/lib/graphql/resolvers";
import { typeDefs } from "@/lib/graphql/typeDefs";

export const schema = createSchema<GraphQLContext>({ typeDefs, resolvers });
