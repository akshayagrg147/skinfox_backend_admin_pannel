import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

export function CampaignSlideshow({ slides }: { slides?: CampaignSlide[] }) {
  const campaignSlides = slides?.length ? slides : defaultCampaignSlides
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const safeIndex = Math.min(activeIndex, campaignSlides.length - 1)
  const slide = campaignSlides[safeIndex]
  const hasMultipleSlides = campaignSlides.length > 1
  const campaignImageKey = campaignSlides.map((item) => `${item.id}:${item.src}:${item.mobileSrc ?? ''}`).join('|')

  useEffect(() => {
    if (activeIndex >= campaignSlides.length) setActiveIndex(0)
  }, [activeIndex, campaignSlides.length])

  useEffect(() => {
    if (!hasMultipleSlides || slide.kind !== 'image' || !isPlaying) return
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % campaignSlides.length)
    }, slide.durationMs)
    return () => window.clearTimeout(timer)
  }, [hasMultipleSlides, slide.durationMs, slide.kind, isPlaying, campaignSlides.length])

  useEffect(() => {
    campaignSlides.forEach((item) => {
      if (item.kind !== 'image') return
      const image = new Image()
      image.src = item.src
      if (item.mobileSrc) {
        const mobileImage = new Image()
        mobileImage.src = item.mobileSrc
      }
    })
  }, [campaignImageKey, campaignSlides])

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + campaignSlides.length) % campaignSlides.length)
    setIsPlaying(true)
  }

  const goTo = (index: number) => {
    setActiveIndex(index)
    setIsPlaying(true)
  }

  const advanceWhenActive = (expectedSlideId: string) => {
    setActiveIndex((current) => (
      campaignSlides[current]?.id === expectedSlideId
        ? (current + 1) % campaignSlides.length
        : current
    ))
    setIsPlaying(true)
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (slide.kind !== 'video' || !video) {
      setIsPlaying((current) => !current)
      return
    }

    if (video.paused) {
      void video.play().catch(() => setIsPlaying(false))
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const poster = slide.poster ?? slide.src

  return (
    <section
      className={`campaign-slideshow campaign-slideshow--${slide.orientation} campaign-slideshow--${slide.kind} ${isPlaying ? '' : 'is-paused'}`}
      role="region"
      aria-labelledby="campaign-slideshow-title"
      aria-roledescription="carousel"
      style={
        {
          '--campaign-poster': `url("${poster}")`,
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
          <div className="campaign-slideshow__intro-copy" aria-live="polite">
            <span className="campaign-slideshow__eyebrow">{slide.eyebrow}</span>
            <p>{slide.description}</p>
          </div>
        </header>

        <div className="campaign-slideshow__canvas">
          <AnimatePresence initial={false}>
            <motion.figure
              key={slide.id}
              className="campaign-slideshow__slide"
              initial={{ opacity: 0, scale: 1.012 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.008 }}
              transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="campaign-slideshow__media">
                <span className="campaign-slideshow__media-backdrop" aria-hidden="true" />
                {slide.kind === 'video' ? (
                  <video
                    ref={videoRef}
                    src={slide.src}
                    poster={slide.poster}
                    aria-label={slide.alt}
                    autoPlay
                    muted={isMuted}
                    loop={!hasMultipleSlides}
                    playsInline
                    preload="metadata"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => hasMultipleSlides && advanceWhenActive(slide.id)}
                  />
                ) : (
                  <picture>
                    {slide.mobileSrc && <source media="(max-width: 720px)" srcSet={slide.mobileSrc} />}
                    <img src={slide.src} alt={slide.alt} decoding="async" />
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
