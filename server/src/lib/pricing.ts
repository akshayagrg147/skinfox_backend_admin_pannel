export type PriceLine = { quantity: number; unitPricePaise: number | null; mrpPaise?: number | null; purchaseState?: string; availableQuantity?: number }
export type CouponRule = { type: 'percentage' | 'fixed'; value: number; minSpendPaise: number; active: boolean; startsAt: Date; endsAt: Date; usageLimit?: number | null; usedCount?: number }

// Product prices in the SkinFox catalogue are customer-facing, GST-inclusive
// amounts. Keep the tax extraction available for invoices/reporting, but never
// add it a second time to the amount collected from the customer.
export const FREE_SHIPPING_THRESHOLD_PAISE = 200000
export const STANDARD_SHIPPING_PAISE = 9900
export const GST_RATE_BPS = 1800

/**
 * Product catalogue prices are GST-inclusive. Keep the extracted values
 * reconciled to the exact customer-facing amount so invoices and checkout
 * summaries never introduce a second tax charge.
 */
export const inclusiveTaxBreakdown = (inclusivePaise: number, rateBps = GST_RATE_BPS) => {
  const amount = Math.max(0, Math.round(Number(inclusivePaise) || 0))
  const taxPaise = Math.floor(amount * rateBps / (10000 + rateBps))
  return { basePaise: amount - taxPaise, taxPaise }
}

export const calculateDiscount = (subtotalPaise: number, coupon?: CouponRule | null) => {
  if (!coupon || !coupon.active || subtotalPaise < coupon.minSpendPaise || coupon.startsAt > new Date() || coupon.endsAt < new Date()) return 0
  const value = coupon.type === 'percentage' ? Math.floor(subtotalPaise * Math.min(coupon.value, 100) / 100) : coupon.value
  return Math.max(0, Math.min(value, subtotalPaise))
}

export const calculateCart = (lines: PriceLine[], coupon?: CouponRule | null, shippingServiceable = true, cod = false) => {
  const subtotalPaise = lines.reduce((total, line) => total + (line.unitPricePaise ?? 0) * line.quantity, 0)
  const discountPaise = calculateDiscount(subtotalPaise, coupon)
  const productTotalPaise = Math.max(0, subtotalPaise - discountPaise)
  const taxBreakdown = inclusiveTaxBreakdown(productTotalPaise)
  const shippingPaise = !shippingServiceable ? 0 : productTotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : (productTotalPaise > 0 ? STANDARD_SHIPPING_PAISE : 0)
  const codPaise = cod && productTotalPaise > 0 ? 4900 : 0
  const totalPaise = productTotalPaise + shippingPaise + codPaise
  const validationMessages = lines.flatMap((line) => [
    line.unitPricePaise === null ? 'This product is coming soon and cannot be paid for yet.' : '',
    line.purchaseState === 'coming_soon' ? 'This product is coming soon and cannot be paid for yet.' : '',
    line.purchaseState === 'discontinued' ? 'This product is no longer available.' : '',
    line.purchaseState === 'out_of_stock' || (line.availableQuantity !== undefined && line.availableQuantity < line.quantity) ? 'The requested quantity is not currently in stock.' : '',
  ].filter(Boolean))
  return { subtotalPaise, discountPaise, productTotalPaise, taxBasePaise: taxBreakdown.basePaise, taxPaise: taxBreakdown.taxPaise, shippingPaise, codPaise, totalPaise, purchaseEligible: validationMessages.length === 0 && shippingServiceable, validationMessages }
}

export const isValidPincode = (pincode: string) => /^[1-9]\d{5}$/.test(pincode)
