import { Check, Minus, Play, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Product, ProductMedia } from '../types'
import { ModalShell } from './ModalShell'
import { ProductPrice, getOfferPriceDetails } from './ProductPrice'

type QuickViewProps = {
  product: Product | null
  onClose: () => void
  onAdd: (product: Product, quantity: number) => void
}

function getProductMedia(product: Product): ProductMedia[] {
  return product.media.length
    ? product.media
    : [{ type: 'image', src: product.image, alt: product.imageAlt }]
}

export function QuickView({ product, onClose, onAdd }: QuickViewProps) {
  const [quantity, setQuantity] = useState(1)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)

  useEffect(() => {
    setQuantity(1)
    setActiveMediaIndex(0)
  }, [product?.id])

  const media = product ? getProductMedia(product) : []
  const activeMedia = media[activeMediaIndex] ?? media[0]
  const offerDetails = product ? getOfferPriceDetails(product) : null

  return (
    <ModalShell open={Boolean(product)} onClose={onClose} title={product ? `${product.name} product details` : 'Product details'} className="quick-view">
      {product && (
        <div className="quick-view__grid">
          <div className="quick-view__visual" style={{ background: `radial-gradient(circle at 50% 35%, ${product.tint}, #eee3d4 70%)` }}>
            <div className="quick-view__photo-stage">
              {activeMedia?.type === 'video' ? (
                <video
                  key={activeMedia.src}
                  src={activeMedia.src}
                  poster={activeMedia.poster}
                  aria-label={activeMedia.alt}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : activeMedia ? (
                <img src={activeMedia.src} alt={activeMedia.alt} decoding="async" />
              ) : null}
            </div>
            {media.length > 1 && (
              <div className="quick-view__media-thumbnails" role="group" aria-label={`${product.name} media gallery`}>
                {media.map((item, index) => {
                  const isActive = index === activeMediaIndex

                  return (
                    <button
                      className={`quick-view__media-thumbnail${isActive ? ' quick-view__media-thumbnail--active' : ''}`}
                      type="button"
                      key={`${item.type}-${item.src}`}
                      onClick={() => setActiveMediaIndex(index)}
                      aria-label={`Show ${item.type} ${index + 1} of ${media.length}: ${item.alt}`}
                      aria-pressed={isActive}
                    >
                      <img src={item.type === 'video' ? (item.poster ?? product.image) : item.src} alt="" />
                      {item.type === 'video' && (
                        <span className="quick-view__media-play" aria-hidden="true">
                          <Play size={12} fill="currentColor" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <span className="viewer-hint">Original SkinFox pack · {product.size}</span>
          </div>
          <div className="quick-view__content">
            <span className="eyebrow">Actual SkinFox product · {product.step}</span>
            <h2>{product.name}</h2>
            <p className="quick-view__subtitle">{product.subtitle}</p>
            <div className="quick-view__pricing">
              <ProductPrice product={product} />
              <span className="quick-view__availability">
                {product.price === null
                  ? product.mrp !== null ? 'MRP is shown; selling price is pending.' : 'Launch pricing is being finalised.'
                  : offerDetails?.hasOffer ? 'Offer applied automatically at checkout.' : 'Available to order online.'}
              </span>
            </div>
            <p className="quick-view__description">{product.description}</p>
            <ul className="quick-view__ingredients">
              {product.highlights.map((highlight) => <li key={highlight}><Check size={14} /> {highlight}</li>)}
            </ul>
            <div className="quick-view__details">
              <span><small>Ritual</small>{product.usage}</span>
              <span><small>Size</small>{product.size}</span>
              <span><small>Concern</small>{product.concern}</span>
            </div>
            <div className="quick-view__purchase">
              <div className="quantity-control" aria-label="Quantity selector">
                <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus size={15} /></button>
                <span aria-live="polite">{quantity}</span>
                <button onClick={() => setQuantity((value) => Math.min(8, value + 1))} aria-label="Increase quantity"><Plus size={15} /></button>
              </div>
              <button className="button button--dark quick-view__add" onClick={() => { onAdd(product, quantity); onClose() }}>
                {product.price === null ? 'Add to bag · Price on launch' : 'Add to bag'}
              </button>
            </div>
            <p className="prototype-note">Complete ingredients, directions and final selling details will be published with the launch pack information.</p>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
