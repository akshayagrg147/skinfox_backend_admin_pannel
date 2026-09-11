export type WaitlistPricingMode = 'exact_revealed_price' | 'discount_off_mrp' | 'percentage_of_mrp'

export type WaitlistPricingLine = {
  productId: string
  productName: string
  productSlug: string
  size: string
  quantity: number
  mrpPaise: number
  exactPricePaise?: number | null
}

export type WaitlistOrderPricingInput = {
  mode: WaitlistPricingMode
  percent?: number | null
  reservationCreditPaise: number
  shippingPaise?: number
  taxPaise?: number
  chargesPaise?: number
}

export type WaitlistOrderPricing = {
  mode: WaitlistPricingMode
  percent: number | null
  mrpSubtotalPaise: number
  memberProductSubtotalPaise: number
  waitlistDiscountPaise: number
  reservationCreditPaise: number
  remainingProductBalancePaise: number
  shippingPaise: number
  taxPaise: number
  chargesPaise: number
  finalAmountDuePaise: number
  lines: Array<WaitlistPricingLine & { unitMemberPricePaise: number; lineTotalPaise: number; lineDiscountPaise: number }>
}

const integer = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer.`)
  return value
}

/**
 * Calculates the immutable commercial snapshot used when a paid waitlist
 * reservation is revealed. All values are integer paise; no floating point
 * currency values cross this boundary.
 */
export function calculateWaitlistOrderPricing(lines: readonly WaitlistPricingLine[], input: WaitlistOrderPricingInput): WaitlistOrderPricing {
  if (!lines.length) throw new RangeError('At least one waitlist product is required.')
  if (!['exact_revealed_price', 'discount_off_mrp', 'percentage_of_mrp'].includes(input.mode)) throw new RangeError('Unsupported waitlist pricing mode.')
  const credit = integer(input.reservationCreditPaise, 'Reservation credit')
  const percent = input.percent == null ? null : integer(input.percent, 'Pricing percentage')
  if (input.mode !== 'exact_revealed_price' && (percent == null || percent < 1 || percent > 99)) throw new RangeError('Pricing percentage must be between 1 and 99.')

  const pricedLines = lines.map((line) => {
    if (!line.productId || !line.productName || !line.productSlug || !line.size) throw new RangeError('Waitlist product details are incomplete.')
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 50) throw new RangeError('Product quantity must be between 1 and 50.')
    const mrp = integer(line.mrpPaise, 'MRP')
    if (mrp < 1) throw new RangeError('MRP must be positive.')
    let unit: number
    if (input.mode === 'exact_revealed_price') unit = integer(line.exactPricePaise ?? 0, 'Revealed price')
    else if (input.mode === 'discount_off_mrp') unit = Math.floor(mrp * (100 - (percent as number)) / 100)
    else unit = Math.floor(mrp * (percent as number) / 100)
    if (unit < 1 || unit > mrp) throw new RangeError('Revealed member price must be between 1 paise and MRP.')
    const lineTotal = unit * line.quantity
    const lineMrp = mrp * line.quantity
    return { ...line, mrpPaise: mrp, unitMemberPricePaise: unit, lineTotalPaise: lineTotal, lineDiscountPaise: lineMrp - lineTotal }
  })
  const mrpSubtotal = pricedLines.reduce((sum, line) => sum + line.mrpPaise * line.quantity, 0)
  const memberSubtotal = pricedLines.reduce((sum, line) => sum + line.lineTotalPaise, 0)
  if (credit > memberSubtotal) throw new RangeError('Reservation credit cannot exceed the revealed product value.')
  const shipping = integer(input.shippingPaise ?? 0, 'Shipping')
  const tax = integer(input.taxPaise ?? 0, 'Tax')
  const charges = integer(input.chargesPaise ?? 0, 'Charges')
  const remaining = memberSubtotal - credit
  const finalAmount = remaining + shipping + tax + charges
  if (!Number.isSafeInteger(finalAmount)) throw new RangeError('Waitlist order total is too large.')
  return { mode: input.mode, percent, mrpSubtotalPaise: mrpSubtotal, memberProductSubtotalPaise: memberSubtotal, waitlistDiscountPaise: mrpSubtotal - memberSubtotal, reservationCreditPaise: credit, remainingProductBalancePaise: remaining, shippingPaise: shipping, taxPaise: tax, chargesPaise: charges, finalAmountDuePaise: finalAmount, lines: pricedLines }
}
