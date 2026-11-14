/**
 * Every operation the client sends, in one file.
 *
 * `graphql()` is generated: codegen reads these strings, checks them against
 * the SDL, and produces a typed document for each. A typo in a field name is a
 * build failure, and the result of sending one of these is typed without a
 * line of hand-written GraphQL types.
 *
 * `documentMode: "string"` means a document is the query text, not a parsed
 * AST — so no part of the `graphql` package reaches the browser, and the
 * document goes over the wire as written.
 */
import { graphql } from "@/lib/graphql/generated/client";

export const CataloguePage = graphql(`
  query CataloguePage {
    catalogue {
      currency
      frameBaseCents
      perCellCents
      limits {
        minWidth
        maxWidth
        minHeight
        maxHeight
        maxWidthWithoutSupport
      }
      modules {
        type
        label
        description
        cells
        priceCents
      }
      finishes {
        finish
        label
        description
        multiplierBasisPoints
      }
    }
  }
`);

export const PriceConfiguration = graphql(`
  mutation PriceConfiguration($input: ConfigurationInput!) {
    priceConfiguration(input: $input) {
      __typename
      ... on PricedConfiguration {
        configuration {
          ...UnitFields
        }
        price {
          ...PriceFields
        }
      }
      ... on InvalidConfiguration {
        violations {
          ...ViolationFields
        }
      }
    }
  }
`);

export const SaveConfiguration = graphql(`
  mutation SaveConfiguration($input: ConfigurationInput!) {
    saveConfiguration(input: $input) {
      __typename
      ... on SavedConfiguration {
        id
        configuration {
          ...UnitFields
        }
        price {
          ...PriceFields
        }
      }
      ... on InvalidConfiguration {
        violations {
          ...ViolationFields
        }
      }
    }
  }
`);

export const RestoreConfiguration = graphql(`
  query RestoreConfiguration($id: ID!) {
    configuration(id: $id) {
      id
      createdAt
      configuration {
        ...UnitFields
      }
      price {
        ...PriceFields
      }
    }
  }
`);

export const UnitFields = graphql(`
  fragment UnitFields on Configuration {
    width
    height
    finish
    description
    centreSupportCell {
      column
      row
    }
    modules {
      type
      column
      row
      cells {
        column
        row
      }
    }
  }
`);

export const PriceFields = graphql(`
  fragment PriceFields on Price {
    currency
    subtotalCents
    finishMultiplierBasisPoints
    totalCents
    lines {
      label
      quantity
      unitCents
      totalCents
    }
  }
`);

export const ViolationFields = graphql(`
  fragment ViolationFields on RuleViolation {
    code
    message
    moduleIndex
    cells {
      column
      row
    }
  }
`);
