/**
 * Builds the Yoga server. The route handler and the integration tests both use
 * this, so the tests exercise the construction that actually runs — the same
 * schema, the same error masking, the same Fetch implementation.
 */
import { createYoga } from "graphql-yoga";
import type { GraphQLContext } from "@/lib/graphql/context";
import { schema } from "@/lib/graphql/schema";

export const GRAPHQL_ENDPOINT = "/api/graphql";

export function createYogaServer(context: () => GraphQLContext) {
  return createYoga({
    schema,
    context,
    graphqlEndpoint: GRAPHQL_ENDPOINT,
    // Yoga defaults to 25 MB. The largest legal request this API accepts is a
    // 30-module configuration plus the query text, which is a few kilobytes,
    // so a request over 64 KB is not a configuration and is refused before it
    // is parsed.
    maxRequestBodySize: 64 * 1024,
    // Node 22 implements all of this natively. Handing Yoga the platform
    // objects keeps it off @whatwg-node/node-fetch, whose Headers imports
    // `inspect` from node:util — absent from Turbopack's server bundle, so the
    // logger threw "inspect is not a function" while reporting an error and
    // every error came back as an empty 500.
    fetchAPI: {
      fetch,
      Request,
      Response,
      Headers,
      FormData,
      ReadableStream,
      WritableStream,
      TransformStream,
      TextEncoder,
      TextDecoder,
      URL,
      URLSearchParams,
      Blob,
      File,
    },
  });
}
