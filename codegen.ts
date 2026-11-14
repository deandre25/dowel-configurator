import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "lib/graphql/typeDefs.ts",
  // The operations the client sends. They are checked against the SDL above,
  // so a typo in a field name fails the build rather than the request.
  documents: ["lib/graphql/operations/**/*.ts"],
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
    "lib/graphql/generated/client/": {
      preset: "client",
      presetConfig: {
        // One generated type per operation, read directly. Fragment masking
        // is a discipline for a large team's component tree; here it would be
        // indirection with nothing on the other side of it.
        fragmentMasking: false,
      },
      config: {
        // A document is its query text, not a parsed AST: no part of the
        // `graphql` package reaches the browser, and what is sent is what is
        // written here.
        documentMode: "string",
        enumsAsTypes: true,
      },
    },
  },
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
};

export default config;
