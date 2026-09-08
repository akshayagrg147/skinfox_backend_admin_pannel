import { formatPrice, formatProductPrice } from '../data/products'
import type { Product } from '../types'

type ProductPriceProps = {
  product: Product
  quantity?: number
  compact?: boolean
  className?: string
}

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

export function ProductPrice({ product, quantity = 1, compact = false, className = '' }: ProductPriceProps) {
  const details = getOfferPriceDetails(product, quantity)
  const classes = ['product-price', compact ? 'product-price--compact' : '', className].filter(Boolean).join(' ')

  if (details.offerPrice === null) {
    return <span className={classes}>{formatProductPrice(product)}</span>
  }

  if (details.mrp === null) {
    return <span className={classes}><strong>{formatPrice(details.offerPrice)}</strong></span>
  }

  return (
    <span
      className={`${classes} ${details.hasOffer ? 'product-price--offer' : 'product-price--comparison'}`}
      aria-label={`Offer price ${formatPrice(details.offerPrice)}. MRP ${formatPrice(details.mrp)}.${details.hasOffer ? ` You save ${formatPrice(details.savings)}.` : ''}`}
    >
      <span className="product-price__label">Offer price</span>
      <strong>{formatPrice(details.offerPrice)}</strong>
      <span className="product-price__mrp">MRP {details.hasOffer ? <s>{formatPrice(details.mrp)}</s> : formatPrice(details.mrp)}</span>
      {details.hasOffer && <span className="product-price__saving">Save {formatPrice(details.savings)} · {details.discountPercent}% off</span>}
    </span>
  )
}
