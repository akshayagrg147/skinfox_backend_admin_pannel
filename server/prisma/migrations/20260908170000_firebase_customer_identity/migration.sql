ALTER TABLE "Customer" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3), ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUid" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerIdentity_provider_providerUid_key" ON "CustomerIdentity"("provider", "providerUid");
CREATE INDEX "CustomerIdentity_customerId_idx" ON "CustomerIdentity"("customerId");
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
