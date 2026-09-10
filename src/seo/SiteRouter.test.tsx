import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteRouter } from './SiteRouter'

vi.mock('../App', () => ({ default: ({ productSlug }: { productSlug?: string }) => <h1>{productSlug ?? 'Storefront'}</h1> }))
afterEach(() => { window.history.replaceState(null, '', '/') })

describe('public page routes', () => {
  it('passes a clean product URL to the existing storefront controller', () => {
    window.history.replaceState(null, '', '/products/rayyvia-sun-protect')
    render(<SiteRouter />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('rayyvia-sun-protect')
  })

  it('keeps existing legal hash links working and preserves referral parameters', () => {
    window.history.replaceState(null, '', '/?ref=SFX-EXAMPLE#privacy-policy')
    render(<SiteRouter />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/privacy-policy')
    expect(window.location.search).toBe('?ref=SFX-EXAMPLE')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://skinfox.in/privacy-policy')
  })
})
