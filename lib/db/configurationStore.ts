/**
 * The only way a resolver reaches saved configurations.
 *
 * A narrow interface rather than the Prisma client itself, for two reasons:
 * the resolvers state exactly what they need from storage, and the integration
 * tests can supply a second, in-memory implementation without casting a
 * PrismaClient into something it is not.
 */
import type { Finish, PlacedModule } from "@/lib/domain/grid";

export type StoredConfiguration = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly finish: Finish;
  /** As written: parsed and validated by the caller, never trusted here. */
  readonly modules: unknown;
  readonly createdAt: Date;
};

export type NewConfiguration = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly finish: Finish;
  readonly modules: readonly PlacedModule[];
};

export type ConfigurationStore = {
  find(id: string): Promise<StoredConfiguration | null>;
  /** Rejects with `IdAlreadyTaken` if the id exists, so the caller can retry. */
  create(configuration: NewConfiguration): Promise<StoredConfiguration>;
};

export class IdAlreadyTaken extends Error {
  constructor(id: string) {
    super(`A configuration already exists with id ${id}`);
    this.name = "IdAlreadyTaken";
  }
}
