import { createContext } from "@/lib/graphql/context";
import { createYogaServer } from "@/lib/graphql/yoga";

const yoga = createYogaServer(createContext);

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
