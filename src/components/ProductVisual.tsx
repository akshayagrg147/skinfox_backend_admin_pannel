import type { Product } from '../types'

export function ProductVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  return (
    <div
      className={`product-visual product-visual--${product.packaging} ${compact ? 'product-visual--compact' : ''}`}
      style={
        {
          '--product-color': product.color,
          '--product-accent': product.accent,
          '--product-tint': product.tint,
          '--photo-image': `url("${product.image}")`,
          '--photo-position': product.imagePosition,
          // Keep the complete supplied artwork visible inside each card. The
          // scale remains a separate knob for future product-specific tuning.
          '--photo-size': 'contain',
          '--photo-scale': String(product.imageScale),
        } as React.CSSProperties
      }
      role={compact ? undefined : 'img'}
      aria-label={compact ? undefined : product.imageAlt}
      aria-hidden={compact ? true : undefined}
    >
      <span className="product-visual__photo" />
      <span className="product-visual__photo-shade" aria-hidden="true" />
    </div>
  )
}
