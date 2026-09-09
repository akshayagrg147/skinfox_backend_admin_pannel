-- Customer sessions may be backed by a Firebase identity. Existing sessions
-- remain valid as legacy sessions until their normal expiry.
ALTER TABLE "CustomerSession"
  ADD COLUMN "firebaseProjectId" TEXT,
  ADD COLUMN "firebaseUid" TEXT;

-- A Firebase UID is stable across linked providers. Keep the original provider
-- column for audit/debugging, while enforcing one SkinFox identity per project
-- and UID so Google and email/password cannot split a linked account.
ALTER TABLE "CustomerIdentity"
  ADD COLUMN "firebaseProjectId" TEXT NOT NULL DEFAULT 'skinfox';

DROP INDEX IF EXISTS "CustomerIdentity_provider_providerUid_key";
CREATE UNIQUE INDEX "CustomerIdentity_firebaseProjectId_providerUid_key"
  ON "CustomerIdentity"("firebaseProjectId", "providerUid");
