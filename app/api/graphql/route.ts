import { createYoga } from "graphql-yoga";
import { createContext } from "@/lib/graphql/context";
import { schema } from "@/lib/graphql/schema";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
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

// Thin wrappers rather than re-exporting Yoga's handler directly: Next 16
// type-checks route exports against its own handler signature.
export function GET(request: Request): Promise<Response> | Response {
  return yoga.handleRequest(request, {});
}

export function POST(request: Request): Promise<Response> | Response {
  return yoga.handleRequest(request, {});
}

export function OPTIONS(request: Request): Promise<Response> | Response {
  return yoga.handleRequest(request, {});
}
