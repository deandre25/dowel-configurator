/**
 * The GraphQL client: one function.
 *
 * There is no client library here, deliberately — this application performs
 * three operations on one view, with nothing to cache, nothing to normalise
 * and no entity shared between them. A library's weight buys none of that, and
 * at 17 KB of first-load budget it would have cost more than the configurator.
 *
 * What it does provide is the thing a client library is actually for: the
 * result is typed from the document, because the document was generated from
 * the schema. `request(PriceConfiguration, { input })` returns the shape that
 * operation returns, and a field that is not in the schema is a build failure.
 */
import type { TypedDocumentString } from "@/lib/graphql/generated/client/graphql";

export const GRAPHQL_ENDPOINT = "/api/graphql";

/** A failure of the request itself, or an error the server reported. */
export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

type GraphQLResponse<TResult> = {
  data?: TResult | null;
  errors?: readonly {
    message: string;
    extensions?: { code?: unknown } | null;
  }[];
};

function firstErrorCode(response: GraphQLResponse<unknown>): string | null {
  const code = response.errors?.[0]?.extensions?.code;
  return typeof code === "string" ? code : null;
}

export async function request<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never>
    ? [variables?: TVariables]
    : [variables: TVariables]
): Promise<TResult> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/graphql-response+json, application/json",
    },
    body: JSON.stringify({ query: document.toString(), variables }),
  });

  let body: GraphQLResponse<TResult>;
  try {
    body = (await response.json()) as GraphQLResponse<TResult>;
  } catch {
    throw new GraphQLRequestError(
      "The server's reply could not be read.",
      null,
      response.status,
    );
  }

  // An expected failure — a rule the visitor broke — arrives in `data` as a
  // union member, not here. Anything in `errors` is a fault.
  if (body.errors !== undefined && body.errors.length > 0) {
    const [first] = body.errors;
    throw new GraphQLRequestError(
      first?.message ?? "The server reported an error.",
      firstErrorCode(body),
      response.status,
    );
  }

  if (body.data === undefined || body.data === null) {
    throw new GraphQLRequestError(
      "The server returned no data.",
      null,
      response.status,
    );
  }

  return body.data;
}
