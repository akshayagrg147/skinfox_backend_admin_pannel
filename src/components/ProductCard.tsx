import { motion } from 'framer-motion'
import { ArrowUpRight, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { productPath } from '../seo/metadata'
import type { Product } from '../types'
import { ProductVisual } from './ProductVisual'
import { ProductPrice } from './ProductPrice'

type ProductCardProps = {
  product: Product
  index: number
  onAdd: (product: Product) => void
}

export function ProductCard({ product, index, onAdd }: ProductCardProps) {
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
      whileHover={{ y: -4 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay: Math.min(index * 0.07, 0.28), ease: [0.22, 1, 0.36, 1] }}
    >
      <a className="product-card__visual" href={productPath(product)} aria-label={`View full details for ${product.name} ${product.subtitle}`}>
        <span className="product-card__badge">{product.badge}</span>
        <ProductVisual product={product} />
        <span className="product-card__explore">Explore <ArrowUpRight size={15} /></span>
      </a>
      <div className="product-card__content">
        <div className="product-card__meta">
          <span>{product.step}</span>
          <span>{product.size}</span>
        </div>
        <a className="product-card__title" href={productPath(product)}>
          <h3>{product.name}</h3><span>{product.subtitle}</span>
        </a>
        <ProductPrice product={product} compact className="product-card__price" />
        <p>{product.benefit}</p>
        <button
          className="quick-add"
          onClick={() => onAdd(product)}
          aria-label={`${product.price === null ? 'Join waitlist at ₹99 for' : 'Add'} ${product.name} ${product.subtitle}`}
        >
          {product.price === null ? 'Join Waitlist @ ₹99/-' : 'Add to bag'} <Plus size={17} />
        </button>
      </div>
    </motion.article>
  )
}
