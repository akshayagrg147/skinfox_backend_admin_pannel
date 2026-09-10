-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Affiliate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AffiliateRedemptionRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PhotoAnalysisUsage" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAnalysisUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoAnalysisUsage_day_idx" ON "PhotoAnalysisUsage"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAnalysisUsage_scope_scopeKey_day_key" ON "PhotoAnalysisUsage"("scope", "scopeKey", "day");
