CREATE TABLE "AffiliatePasswordResetToken" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliatePasswordResetToken_tokenHash_key" ON "AffiliatePasswordResetToken"("tokenHash");
CREATE INDEX "AffiliatePasswordResetToken_affiliateId_expiresAt_idx" ON "AffiliatePasswordResetToken"("affiliateId", "expiresAt");
CREATE INDEX "AffiliatePasswordResetToken_expiresAt_usedAt_idx" ON "AffiliatePasswordResetToken"("expiresAt", "usedAt");

ALTER TABLE "AffiliatePasswordResetToken" ADD CONSTRAINT "AffiliatePasswordResetToken_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
