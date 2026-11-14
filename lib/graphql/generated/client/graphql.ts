/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
import { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
export type ConfigurationInput = {
  finish: Finish;
  /** Rows, from 2 to 5. */
  height: number;
  modules: Array<ModuleInput>;
  /** Columns, from 2 to 6. */
  width: number;
};

export type Finish = "CHARCOAL" | "OAK" | "WHITE";

export type ModuleInput = {
  /** Zero-based, counting from the left. */
  column: number;
  /** Zero-based, counting from the bottom. Row 0 stands on the floor. */
  row: number;
  type: ModuleType;
};

export type ModuleType = "DOOR" | "DRAWER" | "SHELF";

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

export type CataloguePageQueryVariables = Exact<{ [key: string]: never }>;

export type CataloguePageQuery = {
  catalogue: {
    currency: string;
    frameBaseCents: number;
    perCellCents: number;
    limits: {
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
      maxWidthWithoutSupport: number;
    };
    modules: Array<{
      type: ModuleType;
      label: string;
      description: string;
      cells: number;
      priceCents: number;
    }>;
    finishes: Array<{
      finish: Finish;
      label: string;
      description: string;
      multiplierBasisPoints: number;
    }>;
  };
};

export type PriceConfigurationMutationVariables = Exact<{
  input: ConfigurationInput;
}>;

export type PriceConfigurationMutation = {
  priceConfiguration:
    | {
        __typename: "InvalidConfiguration";
        violations: Array<{
          code: RuleCode;
          message: string;
          moduleIndex: number | null;
          cells: Array<{ column: number; row: number }>;
        }>;
      }
    | {
        __typename: "PricedConfiguration";
        configuration: {
          width: number;
          height: number;
          finish: Finish;
          description: string;
          centreSupportCell: { column: number; row: number } | null;
          modules: Array<{
            type: ModuleType;
            column: number;
            row: number;
            cells: Array<{ column: number; row: number }>;
          }>;
        };
        price: {
          currency: string;
          subtotalCents: number;
          finishMultiplierBasisPoints: number;
          totalCents: number;
          lines: Array<{
            label: string;
            quantity: number;
            unitCents: number;
            totalCents: number;
          }>;
        };
      };
};

export type SaveConfigurationMutationVariables = Exact<{
  input: ConfigurationInput;
}>;

export type SaveConfigurationMutation = {
  saveConfiguration:
    | {
        __typename: "InvalidConfiguration";
        violations: Array<{
          code: RuleCode;
          message: string;
          moduleIndex: number | null;
          cells: Array<{ column: number; row: number }>;
        }>;
      }
    | {
        __typename: "SavedConfiguration";
        id: string;
        configuration: {
          width: number;
          height: number;
          finish: Finish;
          description: string;
          centreSupportCell: { column: number; row: number } | null;
          modules: Array<{
            type: ModuleType;
            column: number;
            row: number;
            cells: Array<{ column: number; row: number }>;
          }>;
        };
        price: {
          currency: string;
          subtotalCents: number;
          finishMultiplierBasisPoints: number;
          totalCents: number;
          lines: Array<{
            label: string;
            quantity: number;
            unitCents: number;
            totalCents: number;
          }>;
        };
      };
};

export type RestoreConfigurationQueryVariables = Exact<{
  id: string | number;
}>;

export type RestoreConfigurationQuery = {
  configuration: {
    id: string;
    createdAt: string;
    configuration: {
      width: number;
      height: number;
      finish: Finish;
      description: string;
      centreSupportCell: { column: number; row: number } | null;
      modules: Array<{
        type: ModuleType;
        column: number;
        row: number;
        cells: Array<{ column: number; row: number }>;
      }>;
    };
    price: {
      currency: string;
      subtotalCents: number;
      finishMultiplierBasisPoints: number;
      totalCents: number;
      lines: Array<{
        label: string;
        quantity: number;
        unitCents: number;
        totalCents: number;
      }>;
    };
  } | null;
};

export type UnitFieldsFragment = {
  width: number;
  height: number;
  finish: Finish;
  description: string;
  centreSupportCell: { column: number; row: number } | null;
  modules: Array<{
    type: ModuleType;
    column: number;
    row: number;
    cells: Array<{ column: number; row: number }>;
  }>;
};

export type PriceFieldsFragment = {
  currency: string;
  subtotalCents: number;
  finishMultiplierBasisPoints: number;
  totalCents: number;
  lines: Array<{
    label: string;
    quantity: number;
    unitCents: number;
    totalCents: number;
  }>;
};

export type ViolationFieldsFragment = {
  code: RuleCode;
  message: string;
  moduleIndex: number | null;
  cells: Array<{ column: number; row: number }>;
};

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<
    DocumentTypeDecoration<TResult, TVariables>["__apiType"]
  >;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const UnitFieldsFragmentDoc = new TypedDocumentString(
  `
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
    `,
  { fragmentName: "UnitFields" },
) as unknown as TypedDocumentString<UnitFieldsFragment, unknown>;
export const PriceFieldsFragmentDoc = new TypedDocumentString(
  `
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
    `,
  { fragmentName: "PriceFields" },
) as unknown as TypedDocumentString<PriceFieldsFragment, unknown>;
export const ViolationFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ViolationFields on RuleViolation {
  code
  message
  moduleIndex
  cells {
    column
    row
  }
}
    `,
  { fragmentName: "ViolationFields" },
) as unknown as TypedDocumentString<ViolationFieldsFragment, unknown>;
export const CataloguePageDocument = new TypedDocumentString(`
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
    `) as unknown as TypedDocumentString<
  CataloguePageQuery,
  CataloguePageQueryVariables
>;
export const PriceConfigurationDocument = new TypedDocumentString(`
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
fragment ViolationFields on RuleViolation {
  code
  message
  moduleIndex
  cells {
    column
    row
  }
}`) as unknown as TypedDocumentString<
  PriceConfigurationMutation,
  PriceConfigurationMutationVariables
>;
export const SaveConfigurationDocument = new TypedDocumentString(`
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
fragment ViolationFields on RuleViolation {
  code
  message
  moduleIndex
  cells {
    column
    row
  }
}`) as unknown as TypedDocumentString<
  SaveConfigurationMutation,
  SaveConfigurationMutationVariables
>;
export const RestoreConfigurationDocument = new TypedDocumentString(`
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
}`) as unknown as TypedDocumentString<
  RestoreConfigurationQuery,
  RestoreConfigurationQueryVariables
>;
