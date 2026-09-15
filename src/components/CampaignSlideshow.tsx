import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type CampaignSlide = {
  id: string
  kind: 'image' | 'video'
  src: string
  mobileSrc?: string
  poster?: string
  orientation: 'portrait' | 'landscape'
  durationMs: number
  eyebrow: string
  title: string
  description: string
  alt: string
}

// New campaign images can be added here without changing the slideshow layout.
const defaultCampaignSlides: CampaignSlide[] = [
  {
    id: 'rayyvia-film',
    kind: 'video',
    src: '/media/rayyvia-campaign-slide-01-v2.mp4',
    poster: '/media/rayyvia-campaign-slide-01-v2-poster.jpg',
    orientation: 'landscape',
    durationMs: 10000,
    eyebrow: 'Rayyvia Sun Protect',
    title: 'A brighter daily ritual.',
    description: 'The first film in the SkinFox campaign reel—made for a vivid, joyful sun-care moment.',
    alt: 'SkinFox Rayyvia Sun Protect landscape campaign film',
  },
  {
    id: 'rayyvia-sunshine-banner',
    kind: 'image',
    src: '/media/rayyvia-campaign-slide-02.jpg',
    orientation: 'landscape',
    durationMs: 7000,
    eyebrow: 'Meet Rayyvia',
    title: 'Hello, sunshine.',
    description: 'A wide campaign view for the bright, everyday Rayyvia sun-care ritual.',
    alt: 'SkinFox Rayyvia Sun Protect campaign banner with two women holding the suncream against a blue sky',
  },
  {
    id: 'hydrelle-dry-skin-banner',
    kind: 'image',
    src: '/media/hydrelle-campaign-slide-03.jpg',
    orientation: 'landscape',
    durationMs: 7000,
    eyebrow: 'Meet Hydrelle',
    title: 'Dry-skin care, reimagined.',
    description: 'A bright campaign moment for Hydrelle and its 200 g moisturising-lotion ritual.',
    alt: 'SkinFox Hydrelle campaign banner with two women and the Dry Skin Specialist moisturising lotion',
  },
]

const isBrowser = typeof window !== 'undefined'

const prefersCalmPlayback = () => {
  if (!isBrowser) return false
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return reducedMotion || Boolean(saveData)
}

export function CampaignSlideshow({ slides }: { slides?: CampaignSlide[] }) {
  const campaignSlides = slides?.length ? slides : defaultCampaignSlides
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  // Keep campaign media paused until the section is reached. This avoids
  // starting a video while the storefront is still loading above the fold.
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(() => !isBrowser || document.visibilityState !== 'hidden')
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playAttemptRef = useRef(0)
  const isVisibleRef = useRef(false)
  const hasUserInteractedRef = useRef(false)
  const safeIndex = Math.min(activeIndex, campaignSlides.length - 1)
  const slide = campaignSlides[safeIndex]
  const hasMultipleSlides = campaignSlides.length > 1
  const playbackActive = isPlaying && isVisible && isPageVisible

  // Keep the media start attempt in one place. Calling play() directly from a
  // user gesture (the reel controls or a scroll gesture) is important on
  // mobile browsers, which may reject a later effect-only play request even
  // for a muted inline video.
  const startVideoPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video || slide.kind !== 'video') return
    if (!video.paused) {
      setIsPlaying(true)
      return
    }
    if (typeof video.play !== 'function') {
      // Some embedded previews do not expose HTMLMediaElement playback APIs.
      // Leave the control in its honest paused state rather than showing a
      // misleading pause action over a frozen poster.
      setIsPlaying(false)
      return
    }
    const attempt = ++playAttemptRef.current
    video.muted = isMuted
    let started: Promise<void> | undefined
    try {
      started = video.play() as Promise<void> | undefined
    } catch {
      setIsPlaying(false)
      return
    }
    // Keep the control responsive for browsers whose play() does not return a
    // promise, while reverting it if the browser rejects playback.
    setIsPlaying(true)
    started?.catch(() => {
      if (playAttemptRef.current === attempt) setIsPlaying(false)
    })
  }, [isMuted, slide.kind])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    // IntersectionObserver is supported by all current browsers. The
    // fallback keeps the controls usable in older browsers while still
    // waiting for an explicit browsing gesture before attempting autoplay.
    if (typeof IntersectionObserver === 'undefined') {
      isVisibleRef.current = true
      setIsVisible(true)
      return
    }

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting)
      isVisibleRef.current = visible
      setIsVisible(visible)

      if (!visible) {
        // Leaving the section pauses the reel and lets it start cleanly when
        // the customer comes back to it.
        setIsPlaying(false)
      } else if (hasUserInteractedRef.current && !prefersCalmPlayback()) {
        startVideoPlayback()
      }
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' })
    visibilityObserver.observe(section)
    return () => visibilityObserver.disconnect()
  }, [startVideoPlayback])

  useEffect(() => {
    const markUserInteraction = () => {
      hasUserInteractedRef.current = true

      const section = sectionRef.current
      const rect = section?.getBoundingClientRect()
      const viewportHeight = isBrowser ? window.innerHeight : 0
      const sectionInViewport = Boolean(rect && rect.bottom > 0 && rect.top < viewportHeight && (Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)) / rect.height >= 0.35)

      // A wheel, touch or keyboard gesture is an explicit signal
      // that the customer is browsing. Browser scroll restoration on refresh
      // does not emit these events, so it cannot unexpectedly start playback.
      if ((isVisibleRef.current || sectionInViewport) && !prefersCalmPlayback()) {
        if (!isVisibleRef.current && sectionInViewport) {
          isVisibleRef.current = true
          setIsVisible(true)
        }
        startVideoPlayback()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input, textarea, select')) return
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
        markUserInteraction()
      }
    }

    window.addEventListener('wheel', markUserInteraction, { passive: true })
    window.addEventListener('touchmove', markUserInteraction, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', markUserInteraction)
      window.removeEventListener('touchmove', markUserInteraction)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [startVideoPlayback])

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) setIsPlaying(false)
  }, [prefersReducedMotion])

  useEffect(() => {
    if (activeIndex >= campaignSlides.length) setActiveIndex(0)
  }, [activeIndex, campaignSlides.length])

  useEffect(() => {
    if (!hasMultipleSlides || slide.kind !== 'image' || !playbackActive) return
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % campaignSlides.length)
    }, slide.durationMs)
    return () => window.clearTimeout(timer)
  }, [hasMultipleSlides, slide.durationMs, slide.kind, playbackActive, campaignSlides.length, slide.id])

  useEffect(() => {
    const video = videoRef.current
    if (slide.kind !== 'video' || !video) return
    let active = true
    if (playbackActive) {
      // play() resolves to a promise in browsers, but to undefined in some environments.
      // A canplay retry covers slower mobile media loads without leaving the
      // control in a misleading "pause" state.
      const start = () => {
        if (active) startVideoPlayback()
      }
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) start()
      else video.addEventListener('canplay', start, { once: true })
      return () => {
        active = false
        playAttemptRef.current += 1
        video.removeEventListener('canplay', start)
      }
    } else {
      playAttemptRef.current += 1
      if (!video.paused) video.pause()
      // Reset only when the section is no longer visible. A hidden tab should
      // resume from its current position when the customer returns.
      if (!isVisible) {
        try { video.currentTime = 0 } catch { /* Some media streams are not seekable. */ }
      }
    }
    return () => { active = false }
  }, [isPageVisible, isVisible, isMuted, playbackActive, slide.id, slide.kind, startVideoPlayback])

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + campaignSlides.length) % campaignSlides.length)
  }

  const goTo = (index: number) => {
    setActiveIndex(index)
  }

  const advanceWhenActive = (expectedSlideId: string) => {
    setActiveIndex((current) => (
      campaignSlides[current]?.id === expectedSlideId
        ? (current + 1) % campaignSlides.length
        : current
    ))
  }

  const togglePlayback = () => {
    if (slide.kind !== 'video') {
      setIsPlaying((current) => !current)
      return
    }
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
      playAttemptRef.current += 1
      setIsPlaying(false)
    } else {
      startVideoPlayback()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const poster = slide.poster ?? (slide.kind === 'image' ? slide.src : undefined)

  return (
    <section
      ref={sectionRef}
      className={`campaign-slideshow campaign-slideshow--${slide.orientation} campaign-slideshow--${slide.kind} ${playbackActive ? '' : 'is-paused'}`}
      role="region"
      aria-labelledby="campaign-slideshow-title"
      aria-roledescription="carousel"
      style={
        {
          '--campaign-poster': poster ? `url("${poster}")` : 'none',
          '--campaign-duration': `${slide.durationMs}ms`,
          '--campaign-count': campaignSlides.length,
        } as React.CSSProperties
      }
    >
      <div className="campaign-slideshow__backdrop" aria-hidden="true" />
      <div className="campaign-slideshow__veil" aria-hidden="true" />

      <div className="campaign-slideshow__stage shell">
        <header className="campaign-slideshow__intro">
          <div className="campaign-slideshow__intro-heading">
            <span className="section-number section-number--light">01 / Campaign reel</span>
            <h2 id="campaign-slideshow-title">Daily care,<br /><em>in motion.</em></h2>
          </div>
          <div className="campaign-slideshow__intro-copy" aria-live={playbackActive ? 'off' : 'polite'}>
            <span className="campaign-slideshow__eyebrow">{slide.eyebrow}</span>
            <p>{slide.description}</p>
          </div>
        </header>

        <div className="campaign-slideshow__canvas">
          <AnimatePresence initial={false}>
            <motion.figure
              key={slide.id}
              className="campaign-slideshow__slide"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.012 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.008 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.58, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="campaign-slideshow__media">
                <span className="campaign-slideshow__media-backdrop" aria-hidden="true" />
                {slide.kind === 'video' ? (
                  <video
                    ref={videoRef}
                    src={slide.src}
                    poster={slide.poster}
                    aria-label={slide.alt}
                    muted={isMuted}
                    loop={!hasMultipleSlides}
                    playsInline
                    preload="metadata"
                    onPlay={() => setIsPlaying(true)}
                    onPause={(event) => { if (playbackActive && videoRef.current === event.currentTarget) setIsPlaying(false) }}
                    onError={() => setIsPlaying(false)}
                    onEnded={() => hasMultipleSlides && advanceWhenActive(slide.id)}
                  />
                ) : (
                  <picture>
                    {slide.mobileSrc && <source media="(max-width: 720px)" srcSet={slide.mobileSrc} />}
                    <img src={slide.src} alt={slide.alt} decoding="async" loading="lazy" width={slide.orientation === 'landscape' ? 1600 : 1000} height={slide.orientation === 'landscape' ? 900 : 1400} />
                  </picture>
                )}
                <span className="campaign-slideshow__scrim" aria-hidden="true" />
                <div className="campaign-slideshow__media-topline" aria-hidden="true">
                  <span>SkinFox / Campaign {String(safeIndex + 1).padStart(2, '0')}</span>
                  <span className="campaign-slideshow__status">
                    <b>{String(safeIndex + 1).padStart(2, '0')}</b>
                    <i aria-hidden="true" />
                    <b>{String(campaignSlides.length).padStart(2, '0')}</b>
                  </span>
                </div>
                <figcaption>
                  <span className="campaign-slideshow__caption-label">{slide.kind === 'video' ? 'Campaign film' : 'Campaign still'}</span>
                  <strong>{slide.title}</strong>
                </figcaption>
                <div className="campaign-slideshow__controls" aria-label="Campaign controls">
                  <button type="button" onClick={() => move(-1)} disabled={!hasMultipleSlides} aria-label="Previous campaign slide">
                    <ArrowLeft size={18} />
                  </button>
                  <button className="is-playback" type="button" onClick={togglePlayback} aria-label={isPlaying ? (slide.kind === 'video' ? 'Pause campaign film' : 'Pause campaign reel') : (slide.kind === 'video' ? 'Play campaign film' : 'Play campaign reel')}>
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  {slide.kind === 'video' && (
                    <button type="button" onClick={toggleMute} aria-label={isMuted ? 'Unmute campaign film' : 'Mute campaign film'}>
                      {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                    </button>
                  )}
                  <button type="button" onClick={() => move(1)} disabled={!hasMultipleSlides} aria-label="Next campaign slide">
                    <ArrowRight size={18} />
                  </button>
                </div>
                <div className="campaign-slideshow__progress" aria-hidden="true">
                  {campaignSlides.map((item, index) => <i key={item.id} className={index === safeIndex ? 'is-active' : ''} />)}
                </div>
              </div>
            </motion.figure>
          </AnimatePresence>
        </div>

        <nav className="campaign-slideshow__details" aria-label="Choose a campaign story">
          <div className="campaign-slideshow__details-heading">
            <span>Explore the reel</span>
            <span>{String(campaignSlides.length).padStart(2, '0')} campaign moments</span>
          </div>
          <div className="campaign-slideshow__selectors">
            {campaignSlides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === safeIndex ? 'is-active' : ''}
                onClick={() => goTo(index)}
                aria-current={index === safeIndex ? 'true' : undefined}
                aria-label={`Show campaign ${index + 1}: ${item.title}`}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.eyebrow}</strong>
                <em>{item.title}</em>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </nav>
      </div>
    </section>
  )
}
