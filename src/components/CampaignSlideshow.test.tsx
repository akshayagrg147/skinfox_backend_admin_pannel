import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignSlideshow } from './CampaignSlideshow'

type ObserverCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void

describe('CampaignSlideshow viewport playback', () => {
  let notifyIntersection: ObserverCallback | undefined
  let play: ReturnType<typeof vi.fn>
  let pause: ReturnType<typeof vi.fn>

  beforeEach(() => {
    class TestIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0.35]
      readonly observe = vi.fn()
      readonly disconnect = vi.fn()
      readonly takeRecords = vi.fn(() => [])
      readonly unobserve = vi.fn()

      constructor(callback: ObserverCallback) {
        notifyIntersection = callback
      }
    }

    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    play = vi.fn(() => Promise.resolve())
    pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    notifyIntersection = undefined
  })

  it('keeps the video paused on initial load and starts after scroll and viewport entry', async () => {
    render(<CampaignSlideshow slides={[{
      id: 'campaign-film',
      kind: 'video',
      src: '/media/campaign-film.mp4',
      poster: '/media/campaign-film.jpg',
      orientation: 'landscape',
      durationMs: 10000,
      eyebrow: 'Campaign film',
      title: 'Daily care, in motion.',
      description: 'A campaign film.',
      alt: 'Campaign film',
    }]} />)

    expect(play).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: /daily care, in motion/i }).querySelector('video'))
      .not.toHaveAttribute('autoplay')

    await act(async () => {
      notifyIntersection?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(play).not.toHaveBeenCalled()

    fireEvent.wheel(window)

    expect(play).toHaveBeenCalledOnce()

    await act(async () => {
      notifyIntersection?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    })

    expect(screen.getByRole('button', { name: 'Play campaign film' })).toBeInTheDocument()
  })
})
