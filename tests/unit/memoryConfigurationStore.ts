/**
 * A second implementation of `ConfigurationStore`, for tests.
 *
 * This is why the resolvers depend on a narrow interface rather than on the
 * Prisma client: the integration tests exercise the real resolvers, the real
 * schema and the real rules, with storage that needs no database. The one
 * thing it cannot prove is that Postgres behaves as expected, which is why a
 * save-then-restore is also run against Neon at the gate and against the
 * deployed URL in CI.
 */
import {
  HashAlreadyTaken,
  IdAlreadyTaken,
  type ConfigurationStore,
  type NewConfiguration,
  type StoredConfiguration,
} from "@/lib/db/configurationStore";
import { toStoredModules } from "@/lib/domain/stored";

export type MemoryStore = ConfigurationStore & {
  /** Writes a row directly, to set up rows this build would refuse to write. */
  seed(row: StoredConfiguration): void;
  /** Forces the next `n` creates to report the share id as taken. */
  rejectNextIds(count: number): void;
  /** Forces the next create to report the build as already saved. */
  rejectNextHash(): void;
  /** Reports a row count higher than what is stored, to exercise the ceiling. */
  pretendCount(count: number): void;
  readonly rows: ReadonlyMap<string, StoredConfiguration>;
};

export function memoryConfigurationStore(): MemoryStore {
  const rows = new Map<string, StoredConfiguration>();
  let idsToReject = 0;
  let rejectHash = false;
  let pretendedCount: number | null = null;

  return {
    rows,

    seed(row) {
      rows.set(row.id, row);
    },

    rejectNextIds(count) {
      idsToReject = count;
    },

    rejectNextHash() {
      rejectHash = true;
    },

    pretendCount(count) {
      pretendedCount = count;
    },

    find(id) {
      return Promise.resolve(rows.get(id) ?? null);
    },

    findByHash(hash) {
      return Promise.resolve(
        [...rows.values()].find((row) => row.hash === hash) ?? null,
      );
    },

    count() {
      return Promise.resolve(pretendedCount ?? rows.size);
    },

    create(configuration: NewConfiguration) {
      if (idsToReject > 0) {
        idsToReject -= 1;
        return Promise.reject(new IdAlreadyTaken(configuration.id));
      }
      if (rejectHash) {
        rejectHash = false;
        return Promise.reject(new HashAlreadyTaken(configuration.hash));
      }
      if (rows.has(configuration.id)) {
        return Promise.reject(new IdAlreadyTaken(configuration.id));
      }
      if ([...rows.values()].some((row) => row.hash === configuration.hash)) {
        return Promise.reject(new HashAlreadyTaken(configuration.hash));
      }
      const row: StoredConfiguration = {
        id: configuration.id,
        hash: configuration.hash,
        width: configuration.width,
        height: configuration.height,
        finish: configuration.finish,
        modules: toStoredModules(configuration.modules),
        createdAt: new Date("2026-11-13T10:00:00.000Z"),
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
  };
}
