ALTER TABLE "Customer"
ADD COLUMN "founderNumber" INTEGER,
ADD COLUMN "founderJoinedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Customer_founderNumber_key" ON "Customer"("founderNumber");
