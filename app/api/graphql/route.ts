import { createYoga } from "graphql-yoga";
import { createContext } from "@/lib/graphql/context";
import { schema } from "@/lib/graphql/schema";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  // Next's route handlers speak the Fetch API.
  fetchAPI: { Response },
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
