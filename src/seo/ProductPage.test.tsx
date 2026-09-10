import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { ProductPage } from './ProductPage'

describe('ProductPage', () => {
  it('keeps product detail purchases connected to the existing bag callback', () => {
    const onAdd = vi.fn()
    const onFindCare = vi.fn()
    render(<ProductPage product={products[0]} productSlug={products[0].id} onAdd={onAdd} onFindCare={onFindCare} />)
    expect(screen.getByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Join priority waitlist' }))
    expect(onAdd).toHaveBeenCalledWith(products[0], 2)
    fireEvent.click(screen.getByRole('button', { name: /find your care routine/i }))
    expect(onFindCare).toHaveBeenCalledOnce()
  })

  it('does not allow purchasing stale seed data while current details are loading', () => {
    render(<ProductPage productSlug={products[0].id} loading onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join priority waitlist' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Checking current launch access')
  })

  it('shows a helpful missing-product page after the catalogue finishes loading', () => {
    render(<ProductPage productSlug="unlisted-product" onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We couldn’t find this product.')
    expect(screen.getByRole('link', { name: /explore the collection/i })).toHaveAttribute('href', '/#shop')
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  })
})
