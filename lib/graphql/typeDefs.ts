/**
 * The schema is the source of truth: types in lib/graphql/generated are
 * generated from this SDL, and the resolvers are written against them.
 * Nothing in this project hand-writes a GraphQL type.
 *
 * Two shapes worth noting.
 *
 * An invalid configuration is an expected outcome, not an error, so pricing
 * and saving return unions. A client gets `InvalidConfiguration` with the rule
 * it broke and the cells at fault, in the `data` of a successful response.
 * GraphQL errors are reserved for a fault in the server.
 *
 * Money is integer pence and finish multipliers are basis points, so nothing
 * in this API carries a rounded decimal.
 */
export const typeDefs = /* GraphQL */ `
  type Query {
    "Module types, finishes, limits and prices. The client renders from this rather than from its own copy of the numbers."
    catalogue: Catalogue!

    "A saved build, by the id in its share link. Null when no such build exists, including when the id is malformed."
    configuration(id: ID!): SavedConfiguration

    "Whether the API is answering and whether it can reach the database. Used by the check that runs against the deployed URL."
    health: Health!
  }

  type Mutation {
    """
    Validates a configuration and prices it. The client never computes a price;
    this is the only thing that does.
    """
    priceConfiguration(input: ConfigurationInput!): PriceConfigurationResult!

    """
    Validates a configuration, persists it, and returns the short id that
    becomes its share link. Validated here too: a client can call this
    directly, and an impossible configuration is rejected by the resolver.
    """
    saveConfiguration(input: ConfigurationInput!): SaveConfigurationResult!
  }

  union PriceConfigurationResult = PricedConfiguration | InvalidConfiguration

  union SaveConfigurationResult = SavedConfiguration | InvalidConfiguration

  input ConfigurationInput {
    "Columns, from 2 to 6."
    width: Int!
    "Rows, from 2 to 5."
    height: Int!
    finish: Finish!
    modules: [ModuleInput!]!
  }

  input ModuleInput {
    type: ModuleType!
    "Zero-based, counting from the left."
    column: Int!
    "Zero-based, counting from the bottom. Row 0 stands on the floor."
    row: Int!
  }

  enum ModuleType {
    SHELF
    DRAWER
    DOOR
  }

  enum Finish {
    OAK
    CHARCOAL
    WHITE
  }

  "A rule the server enforces. Each value is a rule in the product, not a class of programming error."
  enum RuleCode {
    "The grid is outside the sizes the system is built in."
    DIMENSIONS_OUT_OF_RANGE
    "More modules than the largest unit has bays."
    TOO_MANY_MODULES
    "A unit with no modules at all."
    EMPTY_UNIT
    "A module placed outside the grid."
    OUT_OF_BOUNDS
    "A drawer in the top row."
    DRAWER_IN_TOP_ROW
    "A door starting in the top row, so its upper half would sit above the unit."
    DOOR_SPANS_TOP_EDGE
    "Two modules claiming the same bay."
    CELL_OCCUPIED
    "A module in the bay a centre support stands in."
    CELL_RESERVED_FOR_SUPPORT
  }

  type Cell {
    column: Int!
    row: Int!
  }

  type PlacedModule {
    type: ModuleType!
    "For a door, the lower of its two cells."
    column: Int!
    row: Int!
    "Every cell this module covers, the anchor included."
    cells: [Cell!]!
  }

  type Configuration {
    width: Int!
    height: Int!
    finish: Finish!
    modules: [PlacedModule!]!
    "The bay a centre support stands in, or null when the unit is narrow enough not to need one."
    centreSupportCell: Cell
    "A sentence describing this build, for the canvas's text alternative."
    description: String!
  }

  type RuleViolation {
    code: RuleCode!
    "Written for a person, in the interface's voice."
    message: String!
    "The cells this violation is about. Empty when it is about the whole unit."
    cells: [Cell!]!
    "Index into the submitted modules, or null when no single module is at fault."
    moduleIndex: Int
  }

  type InvalidConfiguration {
    violations: [RuleViolation!]!
  }

  type PriceLine {
    label: String!
    quantity: Int!
    unitCents: Int!
    totalCents: Int!
  }

  type Price {
    "ISO 4217."
    currency: String!
    lines: [PriceLine!]!
    "Before the finish multiplier."
    subtotalCents: Int!
    "10000 is ×1."
    finishMultiplierBasisPoints: Int!
    totalCents: Int!
  }

  type PricedConfiguration {
    configuration: Configuration!
    price: Price!
  }

  type SavedConfiguration {
    "Eight characters of Crockford base32. This is the share link."
    id: ID!
    "ISO 8601, UTC."
    createdAt: String!
    configuration: Configuration!
    "Priced on read, so a saved link always shows the current price."
    price: Price!
  }

  type Limits {
    minWidth: Int!
    maxWidth: Int!
    minHeight: Int!
    maxHeight: Int!
    "A unit wider than this needs a centre support."
    maxWidthWithoutSupport: Int!
  }

  type ModuleSpec {
    type: ModuleType!
    label: String!
    description: String!
    "Cells covered, counting upwards from the anchor."
    cells: Int!
    priceCents: Int!
  }

  type FinishSpec {
    finish: Finish!
    label: String!
    description: String!
    "10000 is ×1."
    multiplierBasisPoints: Int!
  }

  type Catalogue {
    "ISO 4217."
    currency: String!
    limits: Limits!
    modules: [ModuleSpec!]!
    finishes: [FinishSpec!]!
    frameBaseCents: Int!
    "Charged for every bay in the grid, filled or not."
    perCellCents: Int!
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
