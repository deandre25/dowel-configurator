import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // graphql 17 ships several builds and picks between them by export
      // condition, so "one version installed" does not mean one module
      // instance. Vite resolves graphql's `development` build for the source it
      // transforms; Yoga, which Vitest leaves external, is loaded by Node and
      // gets index.mjs. Across two instances `instanceof GraphQLError` is
      // false, and Yoga decides whether to mask an error with exactly that
      // check — so every deliberate GraphQLError the resolvers throw came back
      // as a generic INTERNAL_SERVER_ERROR, quietly. Pinning the specifier to
      // the build Node resolves keeps it one copy.
      graphql: fileURLToPath(
        new URL("node_modules/graphql/index.mjs", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
    // Playwright owns tests/e2e.
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
