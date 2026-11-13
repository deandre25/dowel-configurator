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
  /** SHA-256 of the configuration's canonical form. Unique. */
  readonly hash: string;
  readonly width: number;
  readonly height: number;
  readonly finish: Finish;
  /** As written: parsed and validated by the caller, never trusted here. */
  readonly modules: unknown;
  readonly createdAt: Date;
};

export type NewConfiguration = {
  readonly id: string;
  readonly hash: string;
  readonly width: number;
  readonly height: number;
  readonly finish: Finish;
  readonly modules: readonly PlacedModule[];
};

export type ConfigurationStore = {
  find(id: string): Promise<StoredConfiguration | null>;

  /** The row for this exact build, if one has been saved already. */
  findByHash(hash: string): Promise<StoredConfiguration | null>;

  /**
   * How many configurations are stored. Read before a row is written, to keep
   * a public unauthenticated write from filling a free-tier database.
   */
  count(): Promise<number>;

  /**
   * Rejects with `IdAlreadyTaken` when the share id exists, so the caller can
   * generate another, and with `HashAlreadyTaken` when the build exists, so
   * the caller can return the row that is already there.
   */
  create(configuration: NewConfiguration): Promise<StoredConfiguration>;
};

export class IdAlreadyTaken extends Error {
  constructor(id: string) {
    super(`A configuration already exists with id ${id}`);
    this.name = "IdAlreadyTaken";
  }
}

/** Two requests saved the same build at the same time. */
export class HashAlreadyTaken extends Error {
  constructor(hash: string) {
    super(`A configuration already exists with hash ${hash}`);
    this.name = "HashAlreadyTaken";
  }
}
