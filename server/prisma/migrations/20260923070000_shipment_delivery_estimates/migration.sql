ALTER TABLE "Shipment"
  ADD COLUMN "estimatedDeliveryFrom" TIMESTAMP(3),
  ADD COLUMN "estimatedDeliveryTo" TIMESTAMP(3);

CREATE TABLE "CustomerNotification" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT,
  "shipmentId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerNotification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerNotification_customerId_createdAt_idx" ON "CustomerNotification"("customerId", "createdAt");
CREATE INDEX "CustomerNotification_customerId_readAt_idx" ON "CustomerNotification"("customerId", "readAt");
