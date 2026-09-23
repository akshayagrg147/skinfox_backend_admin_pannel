import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteRouter } from './SiteRouter'

vi.mock('../App', () => ({ default: ({ productSlug, pageSlug }: { productSlug?: string; pageSlug?: string }) => <h1>{productSlug ?? pageSlug ?? 'Storefront'}</h1> }))
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

  it('routes crawlable care and editorial pages to the storefront controller', async () => {
    for (const [path, expected] of [['/skin-care', 'skin-care'], ['/about', 'about'], ['/faq', 'faq'], ['/guides', 'guides']]) {
      window.history.replaceState(null, '', path)
      const { unmount } = render(<SiteRouter />)
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected))
      unmount()
    }
  })
})
