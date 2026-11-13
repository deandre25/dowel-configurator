import {
  pingDatabase,
  prismaConfigurationStore,
} from "@/lib/db/prismaConfigurationStore";
import type { ConfigurationStore } from "@/lib/db/configurationStore";

/**
 * What every resolver is given. A resolver reaches storage only through this.
 *
 * Both fields are functions rather than values: Yoga assembles its final
 * context by copying this object, and copying a getter evaluates it, which
 * would open a database connection — and require a connection string — on
 * every request including the ones that never touch a table.
 */
export type GraphQLContext = {
  readonly store: () => ConfigurationStore;
  readonly pingDatabase: () => Promise<boolean>;
};

export function createContext(): GraphQLContext {
  return { store: prismaConfigurationStore, pingDatabase };
}
