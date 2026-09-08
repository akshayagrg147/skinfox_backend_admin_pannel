import type { Product } from '../types'

export type OfferPriceDetails = {
  offerPrice: number | null
  mrp: number | null
  savings: number
  discountPercent: number
  hasOffer: boolean
}

export function getOfferPriceDetails(product: Product, quantity = 1): OfferPriceDetails {
  const offerPrice = product.price === null ? null : product.price * quantity
  const mrp = product.mrp === null ? null : product.mrp * quantity
  const savings = offerPrice !== null && mrp !== null ? Math.max(mrp - offerPrice, 0) : 0

  return {
    offerPrice,
    mrp,
    savings,
    discountPercent: mrp && savings ? Math.round((savings / mrp) * 100) : 0,
    hasOffer: savings > 0,
  }
}
