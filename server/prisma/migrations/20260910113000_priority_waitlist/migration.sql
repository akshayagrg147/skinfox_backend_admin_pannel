-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('payment_pending', 'joined', 'payment_failed', 'cancelled', 'refund_pending', 'refunded', 'converted');

-- CreateTable
CREATE TABLE "WaitlistReservation" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'payment_pending',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "depositPaise" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "providerRefundId" TEXT,
    "paymentCapturedPaise" INTEGER NOT NULL DEFAULT 0,
    "refundPaise" INTEGER NOT NULL DEFAULT 0,
    "refundStatus" TEXT,
    "joinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistReservation_publicToken_key" ON "WaitlistReservation"("publicToken");
CREATE UNIQUE INDEX "WaitlistReservation_providerOrderId_key" ON "WaitlistReservation"("providerOrderId");
CREATE UNIQUE INDEX "WaitlistReservation_providerPaymentId_key" ON "WaitlistReservation"("providerPaymentId");
CREATE UNIQUE INDEX "WaitlistReservation_providerRefundId_key" ON "WaitlistReservation"("providerRefundId");
CREATE UNIQUE INDEX "WaitlistReservation_idempotencyKey_key" ON "WaitlistReservation"("idempotencyKey");
CREATE INDEX "WaitlistReservation_customerId_createdAt_idx" ON "WaitlistReservation"("customerId", "createdAt");
CREATE INDEX "WaitlistReservation_status_createdAt_idx" ON "WaitlistReservation"("status", "createdAt");
CREATE UNIQUE INDEX "WaitlistItem_reservationId_productId_key" ON "WaitlistItem"("reservationId", "productId");
CREATE INDEX "WaitlistItem_productId_idx" ON "WaitlistItem"("productId");

-- AddForeignKey
ALTER TABLE "WaitlistReservation" ADD CONSTRAINT "WaitlistReservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistItem" ADD CONSTRAINT "WaitlistItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "WaitlistReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistItem" ADD CONSTRAINT "WaitlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
