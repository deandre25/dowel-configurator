/**
 * Fails if the committed GraphQL types are not what codegen produces from the
 * current SDL.
 *
 * It compares the files on disk with a fresh generation, rather than asking
 * git whether anything changed. `git diff` would also fail for a file that is
 * correct but not yet committed, and a check that reports staleness when
 * nothing is stale is a check people learn to ignore.
 *
 *   npx tsx scripts/check-generated.ts
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GENERATED = "lib/graphql/generated";

/**
 * Files only. The generated output grew a subdirectory when the client
 * documents were added, and a recursive listing includes directories — which
 * then failed with EISDIR when read as files.
 */
function fileList(directory: string): readonly string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((name) => statSync(join(directory, name)).isFile())
    .sort();
}

const backup = mkdtempSync(join(tmpdir(), "dowel-generated-"));
cpSync(GENERATED, backup, { recursive: true });

try {
  execFileSync("npx", ["graphql-codegen", "--config", "codegen.ts"], {
    stdio: "pipe",
  });

  const before = fileList(backup);
  const after = fileList(GENERATED);

  const differences: string[] = [];

  for (const name of new Set([...before, ...after])) {
    const wasThere = before.includes(name);
    const isThere = after.includes(name);
    if (!wasThere) {
      differences.push(`${name}: generated now, missing from the repository`);
      continue;
    }
    if (!isThere) {
      differences.push(`${name}: in the repository, no longer generated`);
      continue;
    }
    const committed = readFileSync(join(backup, name), "utf8");
    const regenerated = readFileSync(join(GENERATED, name), "utf8");
    if (committed !== regenerated) {
      differences.push(`${name}: differs from a fresh generation`);
    }
  }

  if (differences.length > 0) {
    process.stdout.write(
      `The committed GraphQL types are stale. Run \`npm run codegen\` and commit the result.\n\n`,
    );
    for (const difference of differences) {
      process.stdout.write(`  ${difference}\n`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Generated GraphQL types match the SDL (${String(after.length)} file(s) compared).\n`,
    );
  }
} finally {
  rmSync(backup, { recursive: true, force: true });
}
