-- Track the remote media provider and immutable provider asset identifier.
-- Existing website and local uploads remain compatible through the local default.
ALTER TABLE "MediaAsset" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "MediaAsset" ADD COLUMN "providerAssetId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "deliveryUrl" TEXT;
CREATE UNIQUE INDEX "MediaAsset_provider_providerAssetId_key" ON "MediaAsset"("provider", "providerAssetId");
