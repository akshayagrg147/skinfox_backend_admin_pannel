export type PriceLine = { quantity: number; unitPricePaise: number | null; mrpPaise?: number | null; purchaseState?: string; availableQuantity?: number }
export type CouponRule = { type: 'percentage' | 'fixed'; value: number; minSpendPaise: number; active: boolean; startsAt: Date; endsAt: Date; usageLimit?: number | null; usedCount?: number }

export const calculateDiscount = (subtotalPaise: number, coupon?: CouponRule | null) => {
  if (!coupon || !coupon.active || subtotalPaise < coupon.minSpendPaise || coupon.startsAt > new Date() || coupon.endsAt < new Date()) return 0
  const value = coupon.type === 'percentage' ? Math.floor(subtotalPaise * Math.min(coupon.value, 100) / 100) : coupon.value
  return Math.max(0, Math.min(value, subtotalPaise))
}

export const calculateCart = (lines: PriceLine[], coupon?: CouponRule | null, shippingServiceable = true, cod = false) => {
  const subtotalPaise = lines.reduce((total, line) => total + (line.unitPricePaise ?? 0) * line.quantity, 0)
  const discountPaise = calculateDiscount(subtotalPaise, coupon)
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise)
  const taxPaise = Math.floor(taxablePaise * 18 / 118)
  const shippingPaise = !shippingServiceable ? 0 : taxablePaise >= 99900 ? 0 : (taxablePaise > 0 ? 9900 : 0)
  const codPaise = cod && taxablePaise > 0 ? 4900 : 0
  const totalPaise = taxablePaise + taxPaise + shippingPaise + codPaise
  const validationMessages = lines.flatMap((line) => [
    line.unitPricePaise === null ? 'This product is coming soon and cannot be paid for yet.' : '',
    line.purchaseState === 'coming_soon' ? 'This product is coming soon and cannot be paid for yet.' : '',
    line.purchaseState === 'discontinued' ? 'This product is no longer available.' : '',
    line.purchaseState === 'out_of_stock' || (line.availableQuantity !== undefined && line.availableQuantity < line.quantity) ? 'The requested quantity is not currently in stock.' : '',
  ].filter(Boolean))
  return { subtotalPaise, discountPaise, taxPaise, shippingPaise, codPaise, totalPaise, purchaseEligible: validationMessages.length === 0 && shippingServiceable, validationMessages }
}

export const isValidPincode = (pincode: string) => /^[1-9]\d{5}$/.test(pincode)
