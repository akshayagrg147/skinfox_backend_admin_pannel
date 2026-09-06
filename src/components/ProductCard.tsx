import { motion } from 'framer-motion'
import { ArrowUpRight, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { formatProductPrice } from '../data/products'
import type { Product } from '../types'
import { ProductVisual } from './ProductVisual'

type ProductCardProps = {
  product: Product
  index: number
  onView: (product: Product) => void
  onAdd: (product: Product) => void
}

export function ProductCard({ product, index, onView, onAdd }: ProductCardProps) {
  return (
    <motion.article
      className="product-card"
      style={
        {
          '--card-accent': product.accent,
          '--card-tint': product.tint,
        } as CSSProperties
      }
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay: Math.min(index * 0.07, 0.28), ease: [0.22, 1, 0.36, 1] }}
    >
      <button className="product-card__visual" onClick={() => onView(product)} aria-label={`View ${product.name} ${product.subtitle}`}>
        <span className="product-card__badge">{product.badge}</span>
        <span className="product-card__index" aria-hidden="true">{String(index + 1).padStart(2, '0')} / 07</span>
        <ProductVisual product={product} />
        <span className="product-card__explore">Explore <ArrowUpRight size={15} /></span>
      </button>
      <div className="product-card__content">
        <div className="product-card__meta">
          <span>{product.step}</span>
          <span>{product.size}</span>
        </div>
        <button className="product-card__title" onClick={() => onView(product)}>
          <span><strong>{product.name}</strong><small>{product.subtitle}</small></span>
          <span>{formatProductPrice(product)}</span>
        </button>
        <p>{product.benefit}</p>
        <button className="quick-add" onClick={() => onAdd(product)}>
          Add to launch bag <Plus size={17} />
        </button>
      </div>
    </motion.article>
  )
}
