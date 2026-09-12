import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { ProductPage } from './ProductPage'

const waitlist = { enabled: true, depositPaise: 9900, discountPercent: 25, currency: 'INR' as const, refundable: false, termsVersion: '2026-09-10-nonrefundable', paymentConfigured: true, stage: 'waitlist' as const, founderCapacity: 200, founderClaimed: 83, founderRemaining: 117, foundingClosed: false, founderPricePaise: 59900, launchPricePaise: 64900, regularPricePaise: 70000 }

describe('ProductPage', () => {
  it('keeps product detail purchases connected to the existing bag callback', () => {
    const onAdd = vi.fn()
    const onFindCare = vi.fn()
    render(<ProductPage product={products[0]} productSlug={products[0].id} onAdd={onAdd} onFindCare={onFindCare} />)
    expect(screen.getByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Join Waitlist @ ₹99/-' }))
    expect(onAdd).toHaveBeenCalledWith(products[0], 2)
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
    expect(screen.getByRole('img', { name: 'Coco Kiss moisturizing lotion lifestyle campaign artwork' })).toBeInTheDocument()
    fireEvent.click(photoButtons[2])
    expect(screen.getByRole('img', { name: 'Coco Kiss moisturizing lotion product detail artwork' })).toBeInTheDocument()
  })

  it('does not allow purchasing stale seed data while current details are loading', () => {
    render(<ProductPage productSlug={products[0].id} loading onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Waitlist @ ₹99/-' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Checking current launch access')
  })

  it('shows a helpful missing-product page after the catalogue finishes loading', () => {
    render(<ProductPage productSlug="unlisted-product" onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We couldn’t find this product.')
    expect(screen.getByRole('link', { name: /explore the collection/i })).toHaveAttribute('href', '/#shop')
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  })

  it('presents the hidden launch price and live capacity without founder-price or discount language', () => {
    render(<ProductPage product={products[0]} productSlug={products[0].id} waitlist={waitlist} onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByText(/Exclusive Launch Price/)).toHaveTextContent('Revealing Soon')
    expect(screen.getByText('83 / 200')).toBeInTheDocument()
    expect(screen.getByText('117 priority places remaining')).toBeInTheDocument()
    expect(screen.getByText('Reveals soon')).toBeInTheDocument()
    expect(screen.queryByText('₹599')).not.toBeInTheDocument()
    expect(screen.queryByText(/Founder’s Price/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/% off/i)).not.toBeInTheDocument()
  })

  it('shows public launch pricing after the waitlist closes, including for former members', () => {
    const launchSettings = { ...waitlist, enabled: false, stage: 'launch' as const, founderClaimed: 200, founderRemaining: 0, foundingClosed: true }
    const { rerender } = render(<ProductPage product={products[0]} productSlug={products[0].id} waitlist={launchSettings} founderNumber={84} onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByText(/Launch Price/).parentElement).toHaveTextContent('₹649')
    expect(screen.getByRole('button', { name: 'Add to bag' })).toBeInTheDocument()
    expect(screen.queryByText(/Member Launch Price/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Exclusive to the First 200/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Founding 200/i)).not.toBeInTheDocument()
    rerender(<ProductPage product={products[0]} productSlug={products[0].id} waitlist={launchSettings} onAdd={vi.fn()} onFindCare={vi.fn()} />)
    expect(screen.getByText(/Launch Price/).parentElement).toHaveTextContent('₹649')
    expect(screen.getByRole('button', { name: 'Add to bag' })).toBeInTheDocument()
  })
})
