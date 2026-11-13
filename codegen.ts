import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "lib/graphql/typeDefs.ts",
  generates: {
    "lib/graphql/generated/types.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "@/lib/graphql/context#GraphQLContext",
        enumsAsTypes: true,
        avoidOptionals: { field: true },
        immutableTypes: false,
        strictScalars: true,
        defaultScalarType: "unknown",
      },
    },
  },
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
};

export default config;
