ALTER TABLE "CareFinder" ADD COLUMN "config" JSONB;

ALTER TABLE "CareFinderQuestion" ADD COLUMN "selectionMode" TEXT NOT NULL DEFAULT 'single';
ALTER TABLE "CareFinderQuestion" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CareFinderQuestion" ADD COLUMN "condition" JSONB;

ALTER TABLE "CareFinderOption" ADD COLUMN "condition" JSONB;

ALTER TABLE "CareFinderRule" ADD COLUMN "metadata" JSONB;
