import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { ProductPage } from './ProductPage'

describe('ProductPage', () => {
  it('keeps product detail purchases connected to the existing bag callback', () => {
    const onAdd = vi.fn()
    const onFindCare = vi.fn()
    const product = { ...products[0], price: 599 }
    render(<ProductPage product={product} productSlug={product.id} onAdd={onAdd} onFindCare={onFindCare} />)
    expect(screen.getByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }))
    expect(onAdd).toHaveBeenCalledWith(product, 2)
    fireEvent.click(screen.getByRole('button', { name: /find your care routine/i }))
    expect(onFindCare).toHaveBeenCalledOnce()
    expect(screen.queryByRole('link', { name: /back to collection/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Privacy policy' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Terms & conditions' })).not.toBeInTheDocument()
  })

  it('shows every Coco Kiss product photograph on its dedicated page', () => {
    const cocoKiss = products.find((product) => product.id === 'coco-kiss-moisturizing-lotion')!
    render(<ProductPage product={cocoKiss} productSlug={cocoKiss.id} onAdd={vi.fn()} onFindCare={vi.fn()} />)

    const photographs = screen.getByRole('group', { name: 'Coco Kiss photographs' })
    const photoButtons = Array.from(photographs.querySelectorAll('button'))
    expect(photoButtons).toHaveLength(3)
    fireEvent.click(photoButtons[1])
    expect(screen.getAllByRole('img', { name: 'Coco Kiss moisturizing lotion lifestyle campaign artwork' })).toHaveLength(2)
    fireEvent.click(photoButtons[2])
    expect(screen.getAllByRole('img', { name: 'Coco Kiss moisturizing lotion product detail artwork' })).toHaveLength(2)
  })

  it('does not allow purchasing stale seed data while current details are loading', () => {
    render(<ProductPage productSlug={products[0].id} loading onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notify me when available' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Loading product details')
  })

  it('shows a helpful missing-product page after the catalogue finishes loading', () => {
    render(<ProductPage productSlug="unlisted-product" onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We couldn’t find this product.')
    expect(screen.getByRole('link', { name: /explore the collection/i })).toHaveAttribute('href', '/shop')
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  })

  it('shows the configured MRP and selling price without waitlist language', () => {
    const product = { ...products[0], price: 599 }
    render(<ProductPage product={product} productSlug={product.id} onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByText('MRP ₹700')).toBeInTheDocument()
    expect(screen.getByText('₹599')).toBeInTheDocument()
    expect(screen.getByText('Current selling price')).toBeInTheDocument()
    expect(screen.queryByText(/waitlist|founder|reservation|member launch/i)).not.toBeInTheDocument()
  })
})
