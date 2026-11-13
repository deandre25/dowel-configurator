/**
 * The schema is the source of truth: types in lib/graphql/generated are
 * generated from this SDL, and the resolvers are written against them.
 * Nothing in this project hand-writes a GraphQL type.
 */
export const typeDefs = /* GraphQL */ `
  type Query {
    """
    Whether the API is answering and whether it can reach the database. Used by
    the check that runs against the deployed URL.
    """
    health: Health!
  }

  type Health {
    "The route handler executed."
    ok: Boolean!
    "A trivial query reached Postgres through the pooled connection."
    database: Boolean!
    "The schema version this deployment serves."
    schemaVersion: String!
  }
`;
