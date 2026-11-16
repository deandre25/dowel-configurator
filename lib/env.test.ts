import { afterEach, describe, expect, it } from "vitest";
import { databaseUrl } from "@/lib/env";

const original = process.env.DATABASE_URL;

afterEach(() => {
  if (original === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = original;
  }
});

describe("databaseUrl", () => {
  it("returns the pooled connection string", () => {
    process.env.DATABASE_URL = "postgresql://example/db";
    expect(databaseUrl()).toBe("postgresql://example/db");
  });

  it("names the missing variable rather than failing later", () => {
    delete process.env.DATABASE_URL;
    expect(() => databaseUrl()).toThrow(
      "Missing required environment variable DATABASE_URL",
    );
  });

  it("treats an empty value as missing", () => {
    process.env.DATABASE_URL = "";
    expect(() => databaseUrl()).toThrow("DATABASE_URL");
  });
});
