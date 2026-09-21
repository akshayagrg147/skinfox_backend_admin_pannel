import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignSlideshow } from './CampaignSlideshow'

type ObserverCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void

describe('CampaignSlideshow viewport playback', () => {
  let notifyIntersection: ObserverCallback | undefined
  let play: ReturnType<typeof vi.fn>
  let pause: ReturnType<typeof vi.fn>
  let observedElement: Element | undefined
  let videoTop: number

  beforeEach(() => {
    class TestIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0, 0.2]
      readonly observe = vi.fn((target: Element) => { observedElement = target })
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
    videoTop = 1200
    vi.spyOn(HTMLVideoElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: videoTop,
      left: 0,
      top: videoTop,
      right: 640,
      bottom: videoTop + 360,
      width: 640,
      height: 360,
      toJSON: () => ({}),
    }) as DOMRect)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    notifyIntersection = undefined
    observedElement = undefined
  })

  it('autoplays muted when the video itself enters the viewport and pauses when it leaves', async () => {
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

    const campaignVideo = screen.getByRole('region', { name: /daily care, in motion/i }).querySelector('video')
    expect(observedElement).toBe(campaignVideo)
    expect(play).not.toHaveBeenCalled()
    expect(campaignVideo).not.toHaveAttribute('autoplay')

    await act(async () => {
      notifyIntersection?.([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(play).toHaveBeenCalledOnce()
    expect(campaignVideo).toHaveProperty('muted', true)
    expect(campaignVideo).toHaveProperty('defaultMuted', true)
    expect(campaignVideo).toHaveAttribute('muted')
    expect(campaignVideo).toHaveAttribute('autoplay')

    await act(async () => {
      notifyIntersection?.([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver)
    })

    expect(screen.getByRole('button', { name: 'Play campaign film' })).toBeInTheDocument()
    expect(campaignVideo).not.toHaveAttribute('autoplay')
  })

  it('respects the campaign autoplay setting and keeps manual playback available', async () => {
    render(<CampaignSlideshow slides={[{
      id: 'campaign-film',
      kind: 'video',
      src: '/media/campaign-film.mp4',
      poster: '/media/campaign-film.jpg',
      autoplay: false,
      orientation: 'landscape',
      durationMs: 10000,
      eyebrow: 'Campaign film',
      title: 'Daily care, in motion.',
      description: 'A campaign film.',
      alt: 'Campaign film',
    }]} />)

    await act(async () => {
      notifyIntersection?.([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(play).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Play campaign film' }))
    expect(play).toHaveBeenCalledOnce()
  })

  it('starts playback from scroll geometry if the observer misses the entry transition', () => {
    render(<CampaignSlideshow slides={[{
      id: 'campaign-film',
      kind: 'video',
      src: '/media/campaign-film.mp4',
      poster: '/media/campaign-film.jpg',
      autoplay: true,
      orientation: 'landscape',
      durationMs: 10000,
      eyebrow: 'Campaign film',
      title: 'Daily care, in motion.',
      description: 'A campaign film.',
      alt: 'Campaign film',
    }]} />)

    expect(play).not.toHaveBeenCalled()
    videoTop = 100
    fireEvent.scroll(window)

    expect(play).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Pause campaign film' })).toBeInTheDocument()
  })

  it('starts playback when the visibility poll catches a missed browser scroll event', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    render(<CampaignSlideshow slides={[{
      id: 'campaign-film',
      kind: 'video',
      src: '/media/campaign-film.mp4',
      poster: '/media/campaign-film.jpg',
      autoplay: true,
      orientation: 'landscape',
      durationMs: 10000,
      eyebrow: 'Campaign film',
      title: 'Daily care, in motion.',
      description: 'A campaign film.',
      alt: 'Campaign film',
    }]} />)

    expect(play).not.toHaveBeenCalled()
    videoTop = 100

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(play).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Pause campaign film' })).toBeInTheDocument()
  })
})
