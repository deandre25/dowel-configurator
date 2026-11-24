/**
 * Which commit this deployment was built from.
 *
 * Vercel sets `VERCEL_GIT_COMMIT_SHA` for a deployment created from a
 * connected repository; GitHub Actions sets `GITHUB_SHA`. Either identifies
 * the artifact being served, which is the thing the deployed check needs and
 * could not otherwise know.
 *
 * "unknown" is returned rather than an empty string or a throw: a local
 * `next start` has no commit metadata and that is not an error. The check
 * treats "unknown" as a failure to match, which is the safe direction.
 */
export function buildCommit(): string {
  const candidates = [
    process.env["VERCEL_GIT_COMMIT_SHA"],
    process.env["GITHUB_SHA"],
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== "") {
      return candidate;
    }
  }
  return "unknown";
}
