/**
 * Reads the environment once, loudly. A missing connection string should stop
 * the process with the name of the variable, not surface later as a confusing
 * database error.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

/** Pooled connection. Every request the app serves goes through this one. */
export function databaseUrl(): string {
  return required("DATABASE_URL");
}
