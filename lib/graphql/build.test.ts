import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCommit } from "@/lib/graphql/build";

/**
 * These set the environment explicitly rather than reading whatever the
 * process happens to have.
 *
 * The first version of this assertion lived in the resolver test and expected
 * "unknown", which was true on a development machine and false in CI, where
 * GitHub Actions sets GITHUB_SHA. It passed locally for a reason that had
 * nothing to do with the code.
 */
const VARIABLES = ["VERCEL_GIT_COMMIT_SHA", "GITHUB_SHA"] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(
    VARIABLES.map((name) => [name, process.env[name]]),
  );
  for (const name of VARIABLES) {
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of VARIABLES) {
    const value = saved[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("buildCommit", () => {
  it("reports the commit Vercel built from", () => {
    process.env["VERCEL_GIT_COMMIT_SHA"] = "a".repeat(40);
    expect(buildCommit()).toBe("a".repeat(40));
  });

  it("falls back to the commit GitHub Actions is running for", () => {
    process.env["GITHUB_SHA"] = "b".repeat(40);
    expect(buildCommit()).toBe("b".repeat(40));
  });

  it("prefers the deployment's commit over the workflow's", () => {
    // A workflow that deploys would have both, and the one that matters is
    // the artifact being served.
    process.env["VERCEL_GIT_COMMIT_SHA"] = "a".repeat(40);
    process.env["GITHUB_SHA"] = "b".repeat(40);
    expect(buildCommit()).toBe("a".repeat(40));
  });

  it("answers 'unknown' where there is no git metadata at all", () => {
    // A local `next start` has none, and that is not an error. The deployed
    // check treats 'unknown' as a failure to match, which is the safe
    // direction: it will not certify a build it cannot identify.
    expect(buildCommit()).toBe("unknown");
  });

  it("treats an empty value as absent", () => {
    process.env["VERCEL_GIT_COMMIT_SHA"] = "";
    process.env["GITHUB_SHA"] = "c".repeat(40);
    expect(buildCommit()).toBe("c".repeat(40));
  });
});
