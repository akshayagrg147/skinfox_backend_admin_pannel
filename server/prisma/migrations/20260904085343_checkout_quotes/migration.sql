-- CreateTable
CREATE TABLE "CheckoutQuote" (
    "id" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "shippingPaise" INTEGER NOT NULL,
    "codPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "serviceable" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutQuote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
