import { getPrisma } from "@/lib/db/client";
import {
  IdAlreadyTaken,
  type ConfigurationStore,
  type NewConfiguration,
  type StoredConfiguration,
} from "@/lib/db/configurationStore";
import { asFinish, toStoredModules } from "@/lib/domain/stored";

/** Prisma's unique-constraint violation. */
const UNIQUE_VIOLATION = "P2002";

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

function toStored(row: {
  id: string;
  width: number;
  height: number;
  finish: string;
  modules: unknown;
  createdAt: Date;
}): StoredConfiguration {
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

    async create(configuration: NewConfiguration) {
      try {
        const row = await getPrisma().configuration.create({
          data: {
            id: configuration.id,
            width: configuration.width,
            height: configuration.height,
            finish: configuration.finish,
            modules: [...toStoredModules(configuration.modules)],
          },
        });
        return toStored(row);
      } catch (error) {
        if (hasCode(error, UNIQUE_VIOLATION)) {
          throw new IdAlreadyTaken(configuration.id);
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
