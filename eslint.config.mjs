import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated. The GraphQL types are committed and diffed by CI; the Prisma
    // client is regenerated on install. Neither is hand-written, and codegen's
    // own boilerplate uses `any` in resolver plumbing we do not control.
    "lib/graphql/generated/**",
    "lib/db/generated/**",
  ]),
  {
    rules: {
      // The brief's constraints, enforced rather than remembered.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": "error",
    },
  },
]);

export default eslintConfig;
