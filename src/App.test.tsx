import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { products } from './data/products'

vi.mock('./components/three/HeroScene', () => ({ HeroCanvas: () => <div data-testid="hero-3d" /> }))
vi.mock('./components/three/RitualScene', () => ({ RitualCanvas: () => <div data-testid="ritual-3d" /> }))
vi.mock('./components/three/ProductViewer', () => ({ ProductViewer: () => <div data-testid="product-3d" /> }))

describe('SkinFox storefront', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses the supplied official SkinFox logo in the main brand surfaces', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: 'SkinFox home' }).querySelector('img')).toHaveAttribute(
      'src',
      '/brand/skinfox-logo.png',
    )
    expect(document.querySelector('.site-footer__wordmark')).toHaveAttribute('src', '/brand/skinfox-logo.png')
  })

  it('shows a sliding waitlist banner using the live member capacity', () => {
    render(<App />)

    const banner = screen.getByRole('link', { name: /join the waitlist for ₹99 per product/i })
    expect(banner).toHaveAttribute('href', '/#shop')
    expect(banner).toHaveTextContent('Join Waitlist @ ₹99/-')
    expect(banner).toHaveTextContent('Early access for the first 200 members')
    expect(banner).toHaveTextContent('Priority reservation access')
    expect(banner).not.toHaveTextContent(/refundable/i)
    expect(banner.querySelector('.announcement__track')).toBeInTheDocument()
  })

  it('keeps the footer concise and presents contact and affiliate actions', () => {
    render(<App />)

    const footer = within(document.querySelector('.site-footer') as HTMLElement)
    expect(footer.queryByText('Our story')).not.toBeInTheDocument()
    expect(footer.queryByText('My orders')).not.toBeInTheDocument()
    expect(footer.queryByText('Frequently asked questions')).not.toBeInTheDocument()
    expect(footer.getByRole('link', { name: 'SkinFox on Facebook' })).toHaveAttribute(
      'href',
      'https://www.facebook.com/profile.php?id=61593882756421',
    )
    expect(footer.getByRole('link', { name: 'SkinFox on Instagram' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/skinfox_official/',
    )
    expect(footer.getByRole('link', { name: /contact@skinfox.in/i })).toHaveAttribute('href', 'mailto:contact@skinfox.in')
    expect(footer.getByText('Good to know').parentElement).toHaveTextContent('Shipping & returns')
    expect(footer.getByText('Become an affiliate')).toBeInTheDocument()
    expect(footer.getByRole('link', { name: 'Join the SkinFox affiliate programme' })).toHaveAttribute(
      'href',
      'https://affiliate.skinfox.in/',
    )
    expect(footer.getByText(/Designed By Suprix Solution LLP/)).toHaveTextContent(
      '© 2026 SkinFox. All rights reserved. | Designed By Suprix Solution LLP',
    )
  })

  it('adds a product without opening checkout, then opens the bag only from the bag button', async () => {
    render(<App />)

    const hydrelleCardTrigger = screen
      .getAllByRole('link', { name: /view full details for hydrelle dry skin specialist/i })
      .find((link) => link.classList.contains('product-card__visual'))
    const hydrelleCard = hydrelleCardTrigger?.closest('article')
    expect(hydrelleCard).not.toBeNull()
    fireEvent.click(within(hydrelleCard!).getByRole('button', { name: /join waitlist at ₹99 for hydrelle dry skin specialist/i }))

    const bagButton = await screen.findByRole('button', { name: /open bag with 1 items/i })
    expect(screen.queryByRole('dialog', { name: 'Shopping bag' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'SkinFox priority waitlist' })).not.toBeInTheDocument()

    fireEvent.click(bagButton)
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Shopping bag' })).toBeInTheDocument())
    expect(screen.getAllByText(/launch price/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /increase hydrelle quantity/i }))
    expect(screen.getByRole('button', { name: /open bag with 2 items/i })).toBeInTheDocument()
  })

  it('presents multiple real products in the hero and one Hydrelle tube in the motion story', () => {
    render(<App />)

    const heroProducts = within(screen.getByRole('list', { name: 'SkinFox hero products' })).getAllByRole('listitem')
    const heroIds = heroProducts.map((item) => item.getAttribute('data-product-id'))
    const heroCategories = new Set(heroProducts.map((item) => item.getAttribute('data-product-category')))
    expect(heroProducts).toHaveLength(6)
    expect(new Set(heroIds).size).toBe(6)
    expect(heroCategories.size).toBeGreaterThanOrEqual(2)
    expect(screen.queryByLabelText('7 products in the SkinFox launch collection')).not.toBeInTheDocument()

    const storyProducts = within(screen.getByRole('list', { name: 'SkinFox Hydrelle product' })).getAllByRole('listitem')
    expect(storyProducts).toHaveLength(1)
    expect(storyProducts[0]).toHaveAttribute('data-product-id', 'hydrelle-dry-skin-specialist')
    expect(screen.getByText(/hydrelle · one continuous journey/i)).toBeInTheDocument()
    expect(screen.queryByText(/rooted in six botanicals/i)).not.toBeInTheDocument()
  })

  it('cycles through the supplied campaign video and landscape images', async () => {
    render(<App />)

    const slideshow = screen.getByRole('region', { name: /daily care, in motion/i })
    const campaignVideo = slideshow.querySelector('video')
    expect(campaignVideo).not.toBeNull()
    expect(campaignVideo).toHaveAttribute('src', '/media/rayyvia-campaign-slide-01-v2.mp4')
    expect(campaignVideo).toHaveAttribute('poster', '/media/rayyvia-campaign-slide-01-v2-poster.jpg')
    expect(slideshow).toHaveClass('campaign-slideshow--landscape', 'campaign-slideshow--video')
    expect(campaignVideo).toHaveAttribute('autoplay')
    expect(campaignVideo).not.toHaveAttribute('loop')
    expect(campaignVideo).toHaveProperty('muted', true)

    const nextButton = within(slideshow).getByRole('button', { name: /next campaign slide/i })
    expect(nextButton).toBeEnabled()
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(within(slideshow).getByRole('img', { name: /campaign banner with two women/i })).toHaveAttribute(
        'src',
        '/media/rayyvia-campaign-slide-02.jpg',
      )
    })

    fireEvent.ended(campaignVideo!)
    expect(within(slideshow).getByRole('img', { name: /campaign banner with two women/i })).toBeInTheDocument()

    fireEvent.click(nextButton)
    await waitFor(() => {
      expect(within(slideshow).getByRole('img', { name: /hydrelle campaign banner/i })).toHaveAttribute(
        'src',
        '/media/hydrelle-campaign-slide-03.jpg',
      )
    })
    expect(screen.queryByText(/different needs deserve distinct care moments/i)).not.toBeInTheDocument()
  })

  it('groups the catalogue into care ranges that link to real product pages', () => {
    render(<App />)

    const ranges = within(screen.getByRole('list', { name: 'SkinFox care ranges' }))
      .getAllByRole('listitem')
      .filter((item) => item.classList.contains('range-card'))
    expect(ranges.map((range) => within(range).getByRole('heading').textContent)).toEqual(['Skin', 'Body', 'Hair', 'Scalp'])

    const skin = ranges[0]
    expect(within(skin).getByRole('link', { name: /rayyvia sun protect/i })).toHaveAttribute('href', '/products/rayyvia-sun-protect')
    expect(within(skin).getByRole('link', { name: /acnfin soft/i })).toHaveAttribute('href', '/products/acnfin-soft-face-wash')

    const scalp = ranges[3]
    expect(within(scalp).getByText('1 product')).toBeInTheDocument()
    expect(within(scalp).getByRole('link', { name: /intensive scalp & hair treatment/i })).toHaveAttribute(
      'href',
      '/products/intensive-scalp-hair-treatment',
    )
  })

  it('shows every launch product by default, then filters and restores the collection', async () => {
    render(<App />)

    const collection = screen.getByRole('list', { name: 'SkinFox product collection' })
    expect(within(collection).getAllByRole('link', { name: /^view full details for .+/i })).toHaveLength(products.length)

    fireEvent.click(screen.getByRole('button', { name: /hair wash 1/i }))
    await waitFor(() => {
      expect(within(collection).getAllByRole('link', { name: /view full details for onion shampoo gentle cleansing hair wash/i })).toHaveLength(1)
      expect(within(collection).queryByRole('link', { name: /view full details for hydrelle dry skin specialist/i })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`all ${products.length}`, 'i') }))
    await waitFor(() => {
      const collectionTriggers = within(collection).getAllByRole('link', { name: /^view full details for .+/i })
      expect(collectionTriggers).toHaveLength(products.length)
    })
  })

  it('completes the ritual finder and recommends catalogue products', async () => {
    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /find my care/i })[0])
    const quiz = screen.getByRole('dialog', { name: 'Find my care' })
    expect(quiz).toBeInTheDocument()

    fireEvent.click(within(quiz).getByRole('button', { name: 'Continue without a photo' }))
    fireEvent.click(within(quiz).getByRole('button', { name: /^hair /i }))
    await waitFor(() => expect(within(quiz).getByText(/what would you most like to shop for/i)).toBeInTheDocument())

    fireEvent.click(within(quiz).getByRole('button', { name: /^scalp care /i }))
    await waitFor(() => expect(within(quiz).getByText(/how much ritual/i)).toBeInTheDocument())

    fireEvent.click(within(quiz).getByRole('button', { name: /essential/i }))
    await waitFor(() => expect(within(quiz).getByText('Care that fits the way you live.')).toBeInTheDocument())

    expect(within(quiz).getAllByText('Intensive Scalp & Hair Treatment').length).toBeGreaterThan(0)
  })

  it('links the Coco Kiss product image directly to its complete product page', () => {
    render(<App />)

    const cocoLink = screen
      .getAllByRole('link', { name: /view full details for coco kiss moisturizing lotion/i })
      .find((link) => link.classList.contains('product-card__visual'))
    expect(cocoLink).toHaveAttribute('href', '/products/coco-kiss-moisturizing-lotion')
  })

  it('links the Onion Shampoo product image directly to its complete product page', () => {
    render(<App />)

    const shampooLink = screen
      .getAllByRole('link', { name: /view full details for onion shampoo gentle cleansing hair wash/i })
      .find((link) => link.classList.contains('product-card__visual'))
    expect(shampooLink).toHaveAttribute('href', '/products/onion-shampoo')
  })

  it('shows the photographed Hydrelle MRP without treating it as a selling price', () => {
    render(<App />)

    expect(screen.getAllByText(/MRP ₹750/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/price on launch/i).length).toBeGreaterThan(0)
  })
})
