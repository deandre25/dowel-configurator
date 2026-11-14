/* eslint-disable */
import * as types from "./graphql";

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  "\n  query CataloguePage {\n    catalogue {\n      currency\n      frameBaseCents\n      perCellCents\n      limits {\n        minWidth\n        maxWidth\n        minHeight\n        maxHeight\n        maxWidthWithoutSupport\n      }\n      modules {\n        type\n        label\n        description\n        cells\n        priceCents\n      }\n      finishes {\n        finish\n        label\n        description\n        multiplierBasisPoints\n      }\n    }\n  }\n": typeof types.CataloguePageDocument;
  "\n  mutation PriceConfiguration($input: ConfigurationInput!) {\n    priceConfiguration(input: $input) {\n      __typename\n      ... on PricedConfiguration {\n        configuration {\n          ...UnitFields\n        }\n        price {\n          ...PriceFields\n        }\n      }\n      ... on InvalidConfiguration {\n        violations {\n          ...ViolationFields\n        }\n      }\n    }\n  }\n": typeof types.PriceConfigurationDocument;
  "\n  mutation SaveConfiguration($input: ConfigurationInput!) {\n    saveConfiguration(input: $input) {\n      __typename\n      ... on SavedConfiguration {\n        id\n        configuration {\n          ...UnitFields\n        }\n        price {\n          ...PriceFields\n        }\n      }\n      ... on InvalidConfiguration {\n        violations {\n          ...ViolationFields\n        }\n      }\n    }\n  }\n": typeof types.SaveConfigurationDocument;
  "\n  query RestoreConfiguration($id: ID!) {\n    configuration(id: $id) {\n      id\n      createdAt\n      configuration {\n        ...UnitFields\n      }\n      price {\n        ...PriceFields\n      }\n    }\n  }\n": typeof types.RestoreConfigurationDocument;
  "\n  fragment UnitFields on Configuration {\n    width\n    height\n    finish\n    description\n    centreSupportCell {\n      column\n      row\n    }\n    modules {\n      type\n      column\n      row\n      cells {\n        column\n        row\n      }\n    }\n  }\n": typeof types.UnitFieldsFragmentDoc;
  "\n  fragment PriceFields on Price {\n    currency\n    subtotalCents\n    finishMultiplierBasisPoints\n    totalCents\n    lines {\n      label\n      quantity\n      unitCents\n      totalCents\n    }\n  }\n": typeof types.PriceFieldsFragmentDoc;
  "\n  fragment ViolationFields on RuleViolation {\n    code\n    message\n    moduleIndex\n    cells {\n      column\n      row\n    }\n  }\n": typeof types.ViolationFieldsFragmentDoc;
};
const documents: Documents = {
  "\n  query CataloguePage {\n    catalogue {\n      currency\n      frameBaseCents\n      perCellCents\n      limits {\n        minWidth\n        maxWidth\n        minHeight\n        maxHeight\n        maxWidthWithoutSupport\n      }\n      modules {\n        type\n        label\n        description\n        cells\n        priceCents\n      }\n      finishes {\n        finish\n        label\n        description\n        multiplierBasisPoints\n      }\n    }\n  }\n":
    types.CataloguePageDocument,
  "\n  mutation PriceConfiguration($input: ConfigurationInput!) {\n    priceConfiguration(input: $input) {\n      __typename\n      ... on PricedConfiguration {\n        configuration {\n          ...UnitFields\n        }\n        price {\n          ...PriceFields\n        }\n      }\n      ... on InvalidConfiguration {\n        violations {\n          ...ViolationFields\n        }\n      }\n    }\n  }\n":
    types.PriceConfigurationDocument,
  "\n  mutation SaveConfiguration($input: ConfigurationInput!) {\n    saveConfiguration(input: $input) {\n      __typename\n      ... on SavedConfiguration {\n        id\n        configuration {\n          ...UnitFields\n        }\n        price {\n          ...PriceFields\n        }\n      }\n      ... on InvalidConfiguration {\n        violations {\n          ...ViolationFields\n        }\n      }\n    }\n  }\n":
    types.SaveConfigurationDocument,
  "\n  query RestoreConfiguration($id: ID!) {\n    configuration(id: $id) {\n      id\n      createdAt\n      configuration {\n        ...UnitFields\n      }\n      price {\n        ...PriceFields\n      }\n    }\n  }\n":
    types.RestoreConfigurationDocument,
  "\n  fragment UnitFields on Configuration {\n    width\n    height\n    finish\n    description\n    centreSupportCell {\n      column\n      row\n    }\n    modules {\n      type\n      column\n      row\n      cells {\n        column\n        row\n      }\n    }\n  }\n":
    types.UnitFieldsFragmentDoc,
  "\n  fragment PriceFields on Price {\n    currency\n    subtotalCents\n    finishMultiplierBasisPoints\n    totalCents\n    lines {\n      label\n      quantity\n      unitCents\n      totalCents\n    }\n  }\n":
    types.PriceFieldsFragmentDoc,
  "\n  fragment ViolationFields on RuleViolation {\n    code\n    message\n    moduleIndex\n    cells {\n      column\n      row\n    }\n  }\n":
    types.ViolationFieldsFragmentDoc,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query CataloguePage {\n    catalogue {\n      currency\n      frameBaseCents\n      perCellCents\n      limits {\n        minWidth\n        maxWidth\n        minHeight\n        maxHeight\n        maxWidthWithoutSupport\n      }\n      modules {\n        type\n        label\n        description\n        cells\n        priceCents\n      }\n      finishes {\n        finish\n        label\n        description\n        multiplierBasisPoints\n      }\n    }\n  }\n",
): typeof import("./graphql").CataloguePageDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation PriceConfiguration($input: ConfigurationInput!) {\n    priceConfiguration(input: $input) {\n      __typename\n      ... on PricedConfiguration {\n        configuration {\n          ...UnitFields\n        }\n        price {\n          ...PriceFields\n        }\n      }\n      ... on InvalidConfiguration {\n        violations {\n          ...ViolationFields\n        }\n      }\n    }\n  }\n",
): typeof import("./graphql").PriceConfigurationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation SaveConfiguration($input: ConfigurationInput!) {\n    saveConfiguration(input: $input) {\n      __typename\n      ... on SavedConfiguration {\n        id\n        configuration {\n          ...UnitFields\n        }\n        price {\n          ...PriceFields\n        }\n      }\n      ... on InvalidConfiguration {\n        violations {\n          ...ViolationFields\n        }\n      }\n    }\n  }\n",
): typeof import("./graphql").SaveConfigurationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query RestoreConfiguration($id: ID!) {\n    configuration(id: $id) {\n      id\n      createdAt\n      configuration {\n        ...UnitFields\n      }\n      price {\n        ...PriceFields\n      }\n    }\n  }\n",
): typeof import("./graphql").RestoreConfigurationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  fragment UnitFields on Configuration {\n    width\n    height\n    finish\n    description\n    centreSupportCell {\n      column\n      row\n    }\n    modules {\n      type\n      column\n      row\n      cells {\n        column\n        row\n      }\n    }\n  }\n",
): typeof import("./graphql").UnitFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  fragment PriceFields on Price {\n    currency\n    subtotalCents\n    finishMultiplierBasisPoints\n    totalCents\n    lines {\n      label\n      quantity\n      unitCents\n      totalCents\n    }\n  }\n",
): typeof import("./graphql").PriceFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  fragment ViolationFields on RuleViolation {\n    code\n    message\n    moduleIndex\n    cells {\n      column\n      row\n    }\n  }\n",
): typeof import("./graphql").ViolationFieldsFragmentDoc;

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
