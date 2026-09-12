import type { Product } from '../types'
import { productImageSrcSet } from '../utils/productImages'

export function ProductVisual({ product, compact = false, hoverPreview = false }: { product: Product; compact?: boolean; hoverPreview?: boolean }) {
  const secondaryImage = hoverPreview ? product.media.filter((item) => item.type === 'image')[1] : undefined

  return (
    <div
      className={`product-visual product-visual--${product.packaging} ${compact ? 'product-visual--compact' : ''} ${secondaryImage ? 'product-visual--hover-preview' : ''}`}
      style={
        {
          '--product-color': product.color,
          '--product-accent': product.accent,
          '--product-tint': product.tint,
          '--photo-position': product.imagePosition,
          // Keep the complete supplied artwork visible inside each card. The
          // scale remains a separate knob for future product-specific tuning.
          '--photo-size': 'contain',
          '--photo-scale': String(product.imageScale),
        } as React.CSSProperties
      }
      aria-hidden={compact ? true : undefined}
    >
      <img className="product-visual__photo product-visual__photo--primary" src={product.image} srcSet={productImageSrcSet(product.image)} sizes={compact ? '200px' : '(max-width: 560px) 90vw, (max-width: 1000px) 44vw, 400px'} alt={compact ? '' : product.imageAlt} loading="lazy" decoding="async" width={640} height={640} />
      {secondaryImage && <img className="product-visual__photo product-visual__photo--secondary" src={secondaryImage.src} srcSet={productImageSrcSet(secondaryImage.src)} sizes={compact ? '200px' : '(max-width: 560px) 90vw, (max-width: 1000px) 44vw, 400px'} alt="" aria-hidden="true" loading="lazy" decoding="async" width={640} height={640} />}
      <span className="product-visual__photo-shade" aria-hidden="true" />
    </div>
  )
}
