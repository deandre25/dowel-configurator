import { GraphQLResolveInfo } from "graphql";
import { GraphQLContext } from "@/lib/graphql/context";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type Catalogue = {
  __typename?: "Catalogue";
  /** ISO 4217. */
  currency: Scalars["String"]["output"];
  finishes: Array<FinishSpec>;
  frameBaseCents: Scalars["Int"]["output"];
  limits: Limits;
  modules: Array<ModuleSpec>;
  /** Charged for every bay in the grid, filled or not. */
  perCellCents: Scalars["Int"]["output"];
};

export type Cell = {
  __typename?: "Cell";
  column: Scalars["Int"]["output"];
  row: Scalars["Int"]["output"];
};

export type Configuration = {
  __typename?: "Configuration";
  /** The bay a centre support stands in, or null when the unit is narrow enough not to need one. */
  centreSupportCell: Maybe<Cell>;
  /** A sentence describing this build, for the canvas's text alternative. */
  description: Scalars["String"]["output"];
  finish: Finish;
  height: Scalars["Int"]["output"];
  modules: Array<PlacedModule>;
  width: Scalars["Int"]["output"];
};

export type ConfigurationInput = {
  finish: Finish;
  /** Rows, from 2 to 5. */
  height: Scalars["Int"]["input"];
  modules: Array<ModuleInput>;
  /** Columns, from 2 to 6. */
  width: Scalars["Int"]["input"];
};

export type Finish = "CHARCOAL" | "OAK" | "WHITE";

export type FinishSpec = {
  __typename?: "FinishSpec";
  description: Scalars["String"]["output"];
  finish: Finish;
  label: Scalars["String"]["output"];
  /** 10000 is ×1. */
  multiplierBasisPoints: Scalars["Int"]["output"];
};

export type Health = {
  __typename?: "Health";
  /** A trivial query reached Postgres through the pooled connection. */
  database: Scalars["Boolean"]["output"];
  /** The route handler executed. */
  ok: Scalars["Boolean"]["output"];
  /** The schema version this deployment serves. */
  schemaVersion: Scalars["String"]["output"];
};

export type InvalidConfiguration = {
  __typename?: "InvalidConfiguration";
  violations: Array<RuleViolation>;
};

export type Limits = {
  __typename?: "Limits";
  maxHeight: Scalars["Int"]["output"];
  maxWidth: Scalars["Int"]["output"];
  /** A unit wider than this needs a centre support. */
  maxWidthWithoutSupport: Scalars["Int"]["output"];
  minHeight: Scalars["Int"]["output"];
  minWidth: Scalars["Int"]["output"];
};

export type ModuleInput = {
  /** Zero-based, counting from the left. */
  column: Scalars["Int"]["input"];
  /** Zero-based, counting from the bottom. Row 0 stands on the floor. */
  row: Scalars["Int"]["input"];
  type: ModuleType;
};

export type ModuleSpec = {
  __typename?: "ModuleSpec";
  /** Cells covered, counting upwards from the anchor. */
  cells: Scalars["Int"]["output"];
  description: Scalars["String"]["output"];
  label: Scalars["String"]["output"];
  priceCents: Scalars["Int"]["output"];
  type: ModuleType;
};

export type ModuleType = "DOOR" | "DRAWER" | "SHELF";

export type Mutation = {
  __typename?: "Mutation";
  /**
   * Validates a configuration and prices it. The client never computes a price;
   * this is the only thing that does.
   */
  priceConfiguration: PriceConfigurationResult;
  /**
   * Validates a configuration, persists it, and returns the short id that
   * becomes its share link. Validated here too: a client can call this
   * directly, and an impossible configuration is rejected by the resolver.
   */
  saveConfiguration: SaveConfigurationResult;
};

export type MutationPriceConfigurationArgs = {
  input: ConfigurationInput;
};

export type MutationSaveConfigurationArgs = {
  input: ConfigurationInput;
};

export type PlacedModule = {
  __typename?: "PlacedModule";
  /** Every cell this module covers, the anchor included. */
  cells: Array<Cell>;
  /** For a door, the lower of its two cells. */
  column: Scalars["Int"]["output"];
  row: Scalars["Int"]["output"];
  type: ModuleType;
};

export type Price = {
  __typename?: "Price";
  /** ISO 4217. */
  currency: Scalars["String"]["output"];
  /** 10000 is ×1. */
  finishMultiplierBasisPoints: Scalars["Int"]["output"];
  lines: Array<PriceLine>;
  /** Before the finish multiplier. */
  subtotalCents: Scalars["Int"]["output"];
  totalCents: Scalars["Int"]["output"];
};

export type PriceConfigurationResult =
  InvalidConfiguration | PricedConfiguration;

export type PriceLine = {
  __typename?: "PriceLine";
  label: Scalars["String"]["output"];
  quantity: Scalars["Int"]["output"];
  totalCents: Scalars["Int"]["output"];
  unitCents: Scalars["Int"]["output"];
};

export type PricedConfiguration = {
  __typename?: "PricedConfiguration";
  configuration: Configuration;
  price: Price;
};

export type Query = {
  __typename?: "Query";
  /** Module types, finishes, limits and prices. The client renders from this rather than from its own copy of the numbers. */
  catalogue: Catalogue;
  /** A saved build, by the id in its share link. Null when no such build exists, including when the id is malformed. */
  configuration: Maybe<SavedConfiguration>;
  /** Whether the API is answering and whether it can reach the database. Used by the check that runs against the deployed URL. */
  health: Health;
};

export type QueryConfigurationArgs = {
  id: Scalars["ID"]["input"];
};

/** A rule the server enforces. Each value is a rule in the product, not a class of programming error. */
export type RuleCode =
  /** Two modules claiming the same bay. */
  | "CELL_OCCUPIED"
  /** A module in the bay a centre support stands in. */
  | "CELL_RESERVED_FOR_SUPPORT"
  /** The grid is outside the sizes the system is built in. */
  | "DIMENSIONS_OUT_OF_RANGE"
  /** A door starting in the top row, so its upper half would sit above the unit. */
  | "DOOR_SPANS_TOP_EDGE"
  /** A drawer in the top row. */
  | "DRAWER_IN_TOP_ROW"
  /** A unit with no modules at all. */
  | "EMPTY_UNIT"
  /** A module placed outside the grid. */
  | "OUT_OF_BOUNDS"
  /** More modules than the largest unit has bays. */
  | "TOO_MANY_MODULES";

export type RuleViolation = {
  __typename?: "RuleViolation";
  /** The cells this violation is about. Empty when it is about the whole unit. */
  cells: Array<Cell>;
  code: RuleCode;
  /** Written for a person, in the interface's voice. */
  message: Scalars["String"]["output"];
  /** Index into the submitted modules, or null when no single module is at fault. */
  moduleIndex: Maybe<Scalars["Int"]["output"]>;
};

export type SaveConfigurationResult = InvalidConfiguration | SavedConfiguration;

export type SavedConfiguration = {
  __typename?: "SavedConfiguration";
  configuration: Configuration;
  /** ISO 8601, UTC. */
  createdAt: Scalars["String"]["output"];
  /** Eight characters of Crockford base32. This is the share link. */
  id: Scalars["ID"]["output"];
  /** Priced on read, so a saved link always shows the current price. */
  price: Price;
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<
  TResult,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<
  TTypes,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo,
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<
  T = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = Record<PropertyKey, never>,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = {
  PriceConfigurationResult: InvalidConfiguration | PricedConfiguration;
  SaveConfigurationResult: InvalidConfiguration | SavedConfiguration;
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  Catalogue: ResolverTypeWrapper<Catalogue>;
  Cell: ResolverTypeWrapper<Cell>;
  Configuration: ResolverTypeWrapper<Configuration>;
  ConfigurationInput: ConfigurationInput;
  Finish: Finish;
  FinishSpec: ResolverTypeWrapper<FinishSpec>;
  Health: ResolverTypeWrapper<Health>;
  ID: ResolverTypeWrapper<Scalars["ID"]["output"]>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  InvalidConfiguration: ResolverTypeWrapper<InvalidConfiguration>;
  Limits: ResolverTypeWrapper<Limits>;
  ModuleInput: ModuleInput;
  ModuleSpec: ResolverTypeWrapper<ModuleSpec>;
  ModuleType: ModuleType;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PlacedModule: ResolverTypeWrapper<PlacedModule>;
  Price: ResolverTypeWrapper<Price>;
  PriceConfigurationResult: ResolverTypeWrapper<
    ResolversUnionTypes<ResolversTypes>["PriceConfigurationResult"]
  >;
  PriceLine: ResolverTypeWrapper<PriceLine>;
  PricedConfiguration: ResolverTypeWrapper<PricedConfiguration>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RuleCode: RuleCode;
  RuleViolation: ResolverTypeWrapper<RuleViolation>;
  SaveConfigurationResult: ResolverTypeWrapper<
    ResolversUnionTypes<ResolversTypes>["SaveConfigurationResult"]
  >;
  SavedConfiguration: ResolverTypeWrapper<SavedConfiguration>;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars["Boolean"]["output"];
  Catalogue: Catalogue;
  Cell: Cell;
  Configuration: Configuration;
  ConfigurationInput: ConfigurationInput;
  FinishSpec: FinishSpec;
  Health: Health;
  ID: Scalars["ID"]["output"];
  Int: Scalars["Int"]["output"];
  InvalidConfiguration: InvalidConfiguration;
  Limits: Limits;
  ModuleInput: ModuleInput;
  ModuleSpec: ModuleSpec;
  Mutation: Record<PropertyKey, never>;
  PlacedModule: PlacedModule;
  Price: Price;
  PriceConfigurationResult: ResolversUnionTypes<ResolversParentTypes>["PriceConfigurationResult"];
  PriceLine: PriceLine;
  PricedConfiguration: PricedConfiguration;
  Query: Record<PropertyKey, never>;
  RuleViolation: RuleViolation;
  SaveConfigurationResult: ResolversUnionTypes<ResolversParentTypes>["SaveConfigurationResult"];
  SavedConfiguration: SavedConfiguration;
  String: Scalars["String"]["output"];
};

export type CatalogueResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Catalogue"] =
    ResolversParentTypes["Catalogue"],
> = {
  currency?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  finishes?: Resolver<
    Array<ResolversTypes["FinishSpec"]>,
    ParentType,
    ContextType
  >;
  frameBaseCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  limits?: Resolver<ResolversTypes["Limits"], ParentType, ContextType>;
  modules?: Resolver<
    Array<ResolversTypes["ModuleSpec"]>,
    ParentType,
    ContextType
  >;
  perCellCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type CellResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Cell"] =
    ResolversParentTypes["Cell"],
> = {
  column?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  row?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type ConfigurationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Configuration"] =
    ResolversParentTypes["Configuration"],
> = {
  centreSupportCell?: Resolver<
    Maybe<ResolversTypes["Cell"]>,
    ParentType,
    ContextType
  >;
  description?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  finish?: Resolver<ResolversTypes["Finish"], ParentType, ContextType>;
  height?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  modules?: Resolver<
    Array<ResolversTypes["PlacedModule"]>,
    ParentType,
    ContextType
  >;
  width?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type FinishSpecResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FinishSpec"] =
    ResolversParentTypes["FinishSpec"],
> = {
  description?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  finish?: Resolver<ResolversTypes["Finish"], ParentType, ContextType>;
  label?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  multiplierBasisPoints?: Resolver<
    ResolversTypes["Int"],
    ParentType,
    ContextType
  >;
};

export type HealthResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Health"] =
    ResolversParentTypes["Health"],
> = {
  database?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  ok?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  schemaVersion?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type InvalidConfigurationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["InvalidConfiguration"] =
    ResolversParentTypes["InvalidConfiguration"],
> = {
  violations?: Resolver<
    Array<ResolversTypes["RuleViolation"]>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LimitsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Limits"] =
    ResolversParentTypes["Limits"],
> = {
  maxHeight?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  maxWidth?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  maxWidthWithoutSupport?: Resolver<
    ResolversTypes["Int"],
    ParentType,
    ContextType
  >;
  minHeight?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  minWidth?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type ModuleSpecResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["ModuleSpec"] =
    ResolversParentTypes["ModuleSpec"],
> = {
  cells?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  description?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  label?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  priceCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  type?: Resolver<ResolversTypes["ModuleType"], ParentType, ContextType>;
};

export type MutationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Mutation"] =
    ResolversParentTypes["Mutation"],
> = {
  priceConfiguration?: Resolver<
    ResolversTypes["PriceConfigurationResult"],
    ParentType,
    ContextType,
    RequireFields<MutationPriceConfigurationArgs, "input">
  >;
  saveConfiguration?: Resolver<
    ResolversTypes["SaveConfigurationResult"],
    ParentType,
    ContextType,
    RequireFields<MutationSaveConfigurationArgs, "input">
  >;
};

export type PlacedModuleResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PlacedModule"] =
    ResolversParentTypes["PlacedModule"],
> = {
  cells?: Resolver<Array<ResolversTypes["Cell"]>, ParentType, ContextType>;
  column?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  row?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  type?: Resolver<ResolversTypes["ModuleType"], ParentType, ContextType>;
};

export type PriceResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Price"] =
    ResolversParentTypes["Price"],
> = {
  currency?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  finishMultiplierBasisPoints?: Resolver<
    ResolversTypes["Int"],
    ParentType,
    ContextType
  >;
  lines?: Resolver<Array<ResolversTypes["PriceLine"]>, ParentType, ContextType>;
  subtotalCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  totalCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PriceConfigurationResultResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PriceConfigurationResult"] =
    ResolversParentTypes["PriceConfigurationResult"],
> = {
  __resolveType: TypeResolveFn<
    "InvalidConfiguration" | "PricedConfiguration",
    ParentType,
    ContextType
  >;
};

export type PriceLineResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PriceLine"] =
    ResolversParentTypes["PriceLine"],
> = {
  label?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  quantity?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  totalCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  unitCents?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PricedConfigurationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PricedConfiguration"] =
    ResolversParentTypes["PricedConfiguration"],
> = {
  configuration?: Resolver<
    ResolversTypes["Configuration"],
    ParentType,
    ContextType
  >;
  price?: Resolver<ResolversTypes["Price"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Query"] =
    ResolversParentTypes["Query"],
> = {
  catalogue?: Resolver<ResolversTypes["Catalogue"], ParentType, ContextType>;
  configuration?: Resolver<
    Maybe<ResolversTypes["SavedConfiguration"]>,
    ParentType,
    ContextType,
    RequireFields<QueryConfigurationArgs, "id">
  >;
  health?: Resolver<ResolversTypes["Health"], ParentType, ContextType>;
};

export type RuleViolationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["RuleViolation"] =
    ResolversParentTypes["RuleViolation"],
> = {
  cells?: Resolver<Array<ResolversTypes["Cell"]>, ParentType, ContextType>;
  code?: Resolver<ResolversTypes["RuleCode"], ParentType, ContextType>;
  message?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  moduleIndex?: Resolver<Maybe<ResolversTypes["Int"]>, ParentType, ContextType>;
};

export type SaveConfigurationResultResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SaveConfigurationResult"] =
    ResolversParentTypes["SaveConfigurationResult"],
> = {
  __resolveType: TypeResolveFn<
    "InvalidConfiguration" | "SavedConfiguration",
    ParentType,
    ContextType
  >;
};

export type SavedConfigurationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SavedConfiguration"] =
    ResolversParentTypes["SavedConfiguration"],
> = {
  configuration?: Resolver<
    ResolversTypes["Configuration"],
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  price?: Resolver<ResolversTypes["Price"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Catalogue?: CatalogueResolvers<ContextType>;
  Cell?: CellResolvers<ContextType>;
  Configuration?: ConfigurationResolvers<ContextType>;
  FinishSpec?: FinishSpecResolvers<ContextType>;
  Health?: HealthResolvers<ContextType>;
  InvalidConfiguration?: InvalidConfigurationResolvers<ContextType>;
  Limits?: LimitsResolvers<ContextType>;
  ModuleSpec?: ModuleSpecResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PlacedModule?: PlacedModuleResolvers<ContextType>;
  Price?: PriceResolvers<ContextType>;
  PriceConfigurationResult?: PriceConfigurationResultResolvers<ContextType>;
  PriceLine?: PriceLineResolvers<ContextType>;
  PricedConfiguration?: PricedConfigurationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RuleViolation?: RuleViolationResolvers<ContextType>;
  SaveConfigurationResult?: SaveConfigurationResultResolvers<ContextType>;
  SavedConfiguration?: SavedConfigurationResolvers<ContextType>;
};
