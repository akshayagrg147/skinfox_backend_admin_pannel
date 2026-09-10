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

  it('adds an actual product, opens the launch bag, and updates quantity', async () => {
    render(<App />)

    const hydrelleCardTrigger = screen
      .getAllByRole('button', { name: /view hydrelle dry skin specialist/i })
      .find((button) => button.classList.contains('product-card__visual'))
    const hydrelleCard = hydrelleCardTrigger?.closest('article')
    expect(hydrelleCard).not.toBeNull()
    fireEvent.click(within(hydrelleCard!).getByRole('button', { name: /join the waitlist for hydrelle dry skin specialist/i }))

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Shopping bag' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /open bag with 1 items/i })).toBeInTheDocument()
    expect(screen.getAllByText(/price on launch/i).length).toBeGreaterThan(0)

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
    expect(within(collection).getAllByRole('button', { name: /^view .+/i })).toHaveLength(products.length)

    fireEvent.click(screen.getByRole('button', { name: /hair wash 1/i }))
    await waitFor(() => {
      expect(within(collection).getAllByRole('button', { name: /view onion shampoo gentle cleansing hair wash/i })).toHaveLength(1)
      expect(within(collection).queryByRole('button', { name: /view hydrelle dry skin specialist/i })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`all ${products.length}`, 'i') }))
    await waitFor(() => {
      const collectionTriggers = within(collection).getAllByRole('button', { name: /^view .+/i })
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

  it('opens a supplied multi-image gallery and switches to the selected product artwork', async () => {
    render(<App />)

    const cocoTrigger = screen
      .getAllByRole('button', { name: /view coco kiss moisturizing lotion/i })
      .find((button) => button.classList.contains('product-card__visual'))
    expect(cocoTrigger).toBeDefined()
    fireEvent.click(cocoTrigger!)

    const dialog = await screen.findByRole('dialog', { name: 'Coco Kiss product details' })
    const gallery = within(dialog).getByRole('group', { name: 'Coco Kiss media gallery' })
    expect(within(gallery).getAllByRole('button')).toHaveLength(2)
    fireEvent.click(within(gallery).getByRole('button', { name: /show image 2 of 2/i }))
    expect(within(dialog).getByRole('img', { name: /lifestyle campaign artwork/i })).toBeInTheDocument()
  })

  it('offers the supplied Onion Shampoo video as user-controlled gallery media', async () => {
    render(<App />)

    const shampooTrigger = screen
      .getAllByRole('button', { name: /view onion shampoo gentle cleansing hair wash/i })
      .find((button) => button.classList.contains('product-card__visual'))
    expect(shampooTrigger).toBeDefined()
    fireEvent.click(shampooTrigger!)

    const dialog = await screen.findByRole('dialog', { name: 'Onion Shampoo product details' })
    fireEvent.click(within(dialog).getByRole('button', { name: /show video 5 of 5/i }))
    const video = dialog.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveProperty('muted', true)
    expect(video).not.toHaveAttribute('autoplay')
  })

  it('shows the photographed Hydrelle MRP without treating it as a selling price', () => {
    render(<App />)

    expect(screen.getAllByText(/MRP ₹750/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/price on launch/i).length).toBeGreaterThan(0)
  })
})
