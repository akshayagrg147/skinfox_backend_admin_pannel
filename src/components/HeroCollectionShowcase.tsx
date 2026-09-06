import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import type { Product } from '../types'

type HeroCollectionShowcaseProps = {
  products: Product[]
  onView: (product: Product) => void
}

export function HeroCollectionShowcase({ products, onView }: HeroCollectionShowcaseProps) {
  const visibleProducts = products.slice(0, 6)

  return (
    <div
      className="hero__visual hero__visual--collection"
      role="list"
      aria-label="SkinFox hero products"
    >
      <div className="hero-collection__halo" aria-hidden="true" />
      <div className={`hero-collection__grid ${visibleProducts.length > 4 ? 'is-expanded' : ''}`}>
        {visibleProducts.map((product, index) => (
          <motion.figure
            key={product.id}
            className="hero-collection__card"
            role="listitem"
            data-product-id={product.id}
            data-product-category={product.category}
            initial={{ opacity: 0, y: 34, rotate: index % 2 === 0 ? -2 : 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.78, delay: 0.12 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
          >
            <button type="button" onClick={() => onView(product)} aria-label={`View ${product.name} ${product.subtitle}`}>
              <span className="hero-collection__image">
                <img src={product.image} alt={product.imageAlt} decoding="async" />
              </span>
              <figcaption>
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                <small>{product.size}</small>
                <ArrowUpRight size={14} aria-hidden="true" />
              </figcaption>
            </button>
          </motion.figure>
        ))}
      </div>
      <div className="hero-collection__count" aria-label={`${products.length} products in the SkinFox launch collection`}>
        <strong>{String(products.length).padStart(2, '0')}</strong>
        <span className="hero-collection__count-label">products<br />in the launch edit</span>
      </div>
      <p className="hero-collection__caption hero-collection__caption--aside">
        Six featured here · all seven in the shop
      </p>
    </div>
  )
}
