import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `cacheComponents` is off deliberately: the configurator is client-interactive
  // and the one server surface is a GraphQL route handler, so the extra caching
  // semantics would add failure modes without buying anything here.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
