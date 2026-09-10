import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { productPath } from '../seo/metadata'
import type { Product } from '../types'
import { productImageSrcSet } from '../utils/productImages'

type HeroCollectionShowcaseProps = {
  products: Product[]
  loading?: boolean
}

export function HeroCollectionShowcase({ products, loading = false }: HeroCollectionShowcaseProps) {
  const visibleProducts = products.slice(0, 6)

  return (
    <div
      className="hero__visual hero__visual--collection"
      role="list"
      aria-label="SkinFox hero products"
      aria-busy={loading}
    >
      <div className="hero-collection__halo" aria-hidden="true" />
      <div className={`hero-collection__grid ${visibleProducts.length > 4 || loading ? 'is-expanded' : ''}`}>
        {loading && Array.from({ length: 6 }, (_, index) => <div className="hero-skeleton" aria-hidden="true" key={index} />)}
        {visibleProducts.map((product, index) => (
          <motion.figure
            key={product.id}
            className="hero-collection__card"
            role="listitem"
            data-product-id={product.id}
            data-product-category={product.category}
            initial={false}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.78, delay: 0.12 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
          >
            <a href={productPath(product)} aria-label={`View full details for ${product.name} ${product.subtitle}`}>
              <span className="hero-collection__image">
                <img src={product.image} srcSet={productImageSrcSet(product.image)} sizes="(max-width: 680px) 44vw, (max-width: 960px) 28vw, 210px" alt={product.imageAlt} width={320} height={320} decoding="async" loading={index < 3 ? 'eager' : 'lazy'} {...{ fetchpriority: index === 0 ? 'high' : 'auto' }} />
              </span>
              <figcaption>
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                <small>{product.size}</small>
                <ArrowUpRight size={14} aria-hidden="true" />
              </figcaption>
            </a>
          </motion.figure>
        ))}
      </div>
      <p className="hero-collection__caption hero-collection__caption--aside">
        Everyday essentials. One considered collection.
      </p>
    </div>
  )
}
