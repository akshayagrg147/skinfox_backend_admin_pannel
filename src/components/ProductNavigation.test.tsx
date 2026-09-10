import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { HeroCollectionShowcase } from './HeroCollectionShowcase'
import { SearchOverlay } from './SearchOverlay'

describe('product page navigation', () => {
  it('links every hero product to its dedicated details URL', () => {
    render(<HeroCollectionShowcase products={products} />)

    const hero = screen.getByRole('list', { name: 'SkinFox hero products' })
    for (const product of products.slice(0, 6)) {
      expect(within(hero).getByRole('link', { name: new RegExp(`view full details for ${product.name}`, 'i') }))
        .toHaveAttribute('href', `/products/${product.id}`)
    }
  })

  it('links search results to the same dedicated product URLs', () => {
    render(<SearchOverlay open onClose={vi.fn()} catalogue={products} />)

    expect(screen.getByRole('link', { name: /view full details for coco kiss/i }))
      .toHaveAttribute('href', '/products/coco-kiss-moisturizing-lotion')
  })
})
