import { formatPrice, formatProductPrice } from '../data/products'
import type { Product } from '../types'
import { getOfferPriceDetails } from '../utils/productPricing'

type ProductPriceProps = {
  product: Product
  quantity?: number
  compact?: boolean
  className?: string
}

export function ProductPrice({ product, quantity = 1, compact = false, className = '' }: ProductPriceProps) {
  const details = getOfferPriceDetails(product, quantity)
  const classes = ['product-price', compact ? 'product-price--compact' : '', className].filter(Boolean).join(' ')

  if (details.offerPrice === null) {
    return product.mrp !== null ? <span className={`${classes} product-price--founder`} aria-label={`MRP ${formatPrice(product.mrp)}. Exclusive launch price revealing soon.`}><span className="product-price__mrp">MRP {formatPrice(product.mrp)}</span><strong>Launch price</strong><span className="product-price__label">Revealing soon</span></span> : <span className={classes}>{formatProductPrice(product)}</span>
  }

  if (details.mrp === null) {
    return <span className={classes}><strong>{formatPrice(details.offerPrice)}</strong></span>
  }

  return (
    <span
      className={`${classes} ${details.hasOffer ? 'product-price--offer' : 'product-price--comparison'}`}
      aria-label={`${details.hasOffer ? 'Offer price' : 'Price'} ${formatPrice(details.offerPrice)}. MRP ${formatPrice(details.mrp)}.${details.hasOffer ? ` You save ${formatPrice(details.savings)}.` : ''}`}
    >
      <span className="product-price__label">{details.hasOffer ? 'Offer price' : 'Price'}</span>
      <strong>{formatPrice(details.offerPrice)}</strong>
      <span className="product-price__mrp">MRP {details.hasOffer ? <s>{formatPrice(details.mrp)}</s> : formatPrice(details.mrp)}</span>
      {details.hasOffer && <span className="product-price__saving">Save {formatPrice(details.savings)} · {details.discountPercent}% off</span>}
    </span>
  )
}
