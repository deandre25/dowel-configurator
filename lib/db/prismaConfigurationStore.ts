import { getPrisma } from "@/lib/db/client";
import {
  HashAlreadyTaken,
  IdAlreadyTaken,
  type ConfigurationStore,
  type NewConfiguration,
  type StoredConfiguration,
} from "@/lib/db/configurationStore";
import { isUniqueViolation, violatedUniqueKey } from "@/lib/db/uniqueViolation";
import { asFinish, toStoredModules } from "@/lib/domain/stored";

type Row = {
  id: string;
  hash: string;
  width: number;
  height: number;
  finish: string;
  modules: unknown;
  createdAt: Date;
};

function toStored(row: Row): StoredConfiguration {
  const finish = asFinish(row.finish);
  if (finish === null) {
    // The column is a Postgres enum, so this means the enum and this code have
    // drifted apart. Loudly, rather than as a default finish.
    throw new Error(
      `Configuration ${row.id} has finish ${row.finish}, which this build does not know`,
    );
  }
  return {
    id: row.id,
    hash: row.hash,
    width: row.width,
    height: row.height,
    finish,
    modules: row.modules,
    createdAt: row.createdAt,
  };
}

export function prismaConfigurationStore(): ConfigurationStore {
  return {
    async find(id) {
      const row = await getPrisma().configuration.findUnique({ where: { id } });
      return row === null ? null : toStored(row);
    },

    async findByHash(hash) {
      const row = await getPrisma().configuration.findUnique({
        where: { hash },
      });
      return row === null ? null : toStored(row);
    },

    count() {
      return getPrisma().configuration.count();
    },

    async create(configuration: NewConfiguration) {
      try {
        const row = await getPrisma().configuration.create({
          data: {
            id: configuration.id,
            hash: configuration.hash,
            width: configuration.width,
            height: configuration.height,
            finish: configuration.finish,
            modules: [...toStoredModules(configuration.modules)],
          },
        });
        return toStored(row);
      } catch (error) {
        const key = violatedUniqueKey(error);
        if (key === "id") {
          throw new IdAlreadyTaken(configuration.id);
        }
        if (key === "hash") {
          throw new HashAlreadyTaken(configuration.hash);
        }
        if (isUniqueViolation(error)) {
          // A unique violation this build cannot attribute to a constraint.
          // Guessing would silently disable either the id retry or the
          // deduplication, so it raises instead, with what it was given.
          throw new Error(
            `Unique constraint violated but the constraint could not be identified: ${JSON.stringify(
              (error as { meta?: unknown }).meta,
            )}`,
            { cause: error },
          );
        }
        throw error;
      }
    },
  };
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await getPrisma().$queryRaw`select 1`;
    return true;
  } catch {
    return false;
  }
}
