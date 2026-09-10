import { describe, expect, it } from 'vitest'
import { products as fixedProducts } from '../data/products'
import { mapCatalogProducts, mapProduct } from './useStorefront'

describe('static storefront catalogue artwork', () => {
  it('keeps bundled artwork when the API contains different image fields', () => {
    const fixed = fixedProducts[0]
    const mapped = mapProduct({
      ...fixed,
      slug: fixed.id,
      image: 'https://example.com/unapproved-upload.webp',
      imageAlt: 'Unapproved image',
      media: [{ type: 'image', src: 'https://example.com/unapproved-gallery.webp', alt: 'Unapproved gallery image' }],
      pricePaise: 59900,
      mrpPaise: 70000,
    })

    expect(mapped.image).toBe(fixed.image)
    expect(mapped.imageAlt).toBe(fixed.imageAlt)
    expect(mapped.media).toEqual(fixed.media)
    expect(mapped.price).toBe(599)
    expect(mapped.mrp).toBe(700)
  })

  it('keeps the seven launch products first and includes newly created products', () => {
    const reversed = [...fixedProducts].reverse().map((product) => ({ ...product, slug: product.id }))
    const newProduct = {
      ...reversed[0],
      slug: 'new-eighth-product',
      image: '/products/new-eighth-product.webp',
      imageAlt: 'New SkinFox product in its retail packaging',
      media: [{ type: 'image', src: '/products/new-eighth-product.webp', alt: 'New SkinFox product in its retail packaging' }],
    }
    const mapped = mapCatalogProducts([newProduct, ...reversed])

    expect(mapped).toHaveLength(8)
    expect(mapped.slice(0, 7).map((product) => product.id)).toEqual(fixedProducts.map((product) => product.id))
    expect(mapped[7]).toMatchObject({ id: 'new-eighth-product', image: '/products/new-eighth-product.webp' })
  })
})
