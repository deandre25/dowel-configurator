-- A configuration's hash is the SHA-256 of its canonical form, computed by the
-- application. Computing it here would mean reimplementing that
-- canonicalisation in SQL, where the two could then drift apart silently.
--
-- So rows written before this migration are removed rather than backfilled.
-- At the time of writing there was exactly one: a configuration saved while
-- verifying the API at the Phase 2 gate. No share link of consequence is lost.
DELETE FROM "Configuration";

ALTER TABLE "Configuration" ADD COLUMN "hash" TEXT NOT NULL;

-- Unique, so saving the same build twice returns the existing row instead of
-- writing another. This is a public, unauthenticated write.
CREATE UNIQUE INDEX "Configuration_hash_key" ON "Configuration"("hash");
