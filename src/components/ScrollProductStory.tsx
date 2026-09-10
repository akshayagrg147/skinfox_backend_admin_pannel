import { ArrowRight, Droplets, Sparkles } from 'lucide-react'
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Product } from '../types'
import { SCALP_STORY_MOTION, getScrollStoryStep, shouldUseEnhancedStory } from './scrollStory'

type ScrollProductStoryProps = {
  product: Product
  onView: (product: Product) => void
}

function canUseEnhancedStory() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return shouldUseEnhancedStory({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(connection?.saveData),
  })
}

function BottleAsset({ product }: { product: Product }) {
  const assetMode = product.id === 'hydrelle-dry-skin-specialist'
    ? 'is-hydrelle'
    : product.storyImage
      ? 'is-alpha'
      : 'is-cropped'

  return (
    <span className={`scroll-story__bottle-window ${assetMode}`}>
      <img
        className="scroll-story__cutout"
        src={product.storyImage ?? product.image}
        alt={`${product.name} ${product.size} ${product.packaging === 'tube' ? 'tube' : 'bottle'} in the SkinFox scroll story`}
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}

function StaticStory({ product, onView }: ScrollProductStoryProps) {
  return (
    <section
      className="scroll-story scroll-story--static"
      aria-labelledby="scroll-story-static-title"
    >
      <div className="shell scroll-story-static__heading">
        <p className="eyebrow"><Sparkles size={13} /> One tube · four moisture chapters</p>
        <h2 id="scroll-story-static-title">Moisture.<br /><em>Made visible.</em></h2>
        <p>The 200 g Hydrelle Dry Skin Specialist, presented as one focused tube story while the complete SkinFox launch edit remains available above.</p>
      </div>

      <div
        className="shell scroll-story-static__layout"
        role="list"
        aria-label={`SkinFox ${product.name} product`}
      >
        <figure
          className="scroll-story-static__visual scroll-story-static__visual--solo"
          role="listitem"
          data-product-id={product.id}
        >
          <button type="button" onClick={() => onView(product)} aria-label={`View ${product.name} product details`}>
            <BottleAsset product={product} />
          </button>
          <figcaption>{product.name} · {product.size}</figcaption>
        </figure>

        <div className="scroll-story-static__facts">
          <article><span>01</span><div><h3>Dry-skin focus</h3><p>The photographed front pack presents Hydrelle as a Dry Skin Specialist moisturising lotion.</p></div></article>
          <article><span>02</span><div><h3>Generous tube format</h3><p>A 200 g navy-and-white tube gives the moisturising ritual a clear, distinctive presence.</p></div></article>
          <article><span>03</span><div><h3>One continuous product story</h3><p>The same Hydrelle tube stays present from introduction through detail—without product swaps or visual jumps.</p></div></article>
          <div className="scroll-story__actions">
            <button className="button button--dark" type="button" onClick={() => onView(product)}>
              Explore Hydrelle <ArrowRight size={16} />
            </button>
            <a className="button button--ghost" href="#shop">View all products</a>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ScrollProductStory(props: ScrollProductStoryProps) {
  const [enhanced, setEnhanced] = useState(canUseEnhancedStory)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & {
      connection?: {
        addEventListener?: (type: 'change', listener: () => void) => void
        removeEventListener?: (type: 'change', listener: () => void) => void
      }
    }).connection
    const updateMode = () => setEnhanced(canUseEnhancedStory())

    updateMode()
    reducedQuery.addEventListener('change', updateMode)
    connection?.addEventListener?.('change', updateMode)
    return () => {
      reducedQuery.removeEventListener('change', updateMode)
      connection?.removeEventListener?.('change', updateMode)
    }
  }, [])

  return enhanced ? <EnhancedStory {...props} /> : <StaticStory {...props} />
}

function EnhancedStory({ product, onView }: ScrollProductStoryProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const activeStepRef = useRef(0)
  const [activeStep, setActiveStep] = useState(0)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const motionProgress = [...SCALP_STORY_MOTION.progress]

  const bottleX = useTransform(
    scrollYProgress,
    motionProgress,
    SCALP_STORY_MOTION.xVw.map((value) => `${value}vw`),
    { ease: SCALP_STORY_MOTION.ease },
  )
  const bottleY = useTransform(
    scrollYProgress,
    motionProgress,
    SCALP_STORY_MOTION.yVh.map((value) => `${value}vh`),
    { ease: SCALP_STORY_MOTION.ease },
  )
  const bottleRotate = useTransform(
    scrollYProgress,
    motionProgress,
    [...SCALP_STORY_MOTION.rotateDeg],
    { ease: SCALP_STORY_MOTION.ease },
  )
  const bottleScale = useTransform(
    scrollYProgress,
    motionProgress,
    [...SCALP_STORY_MOTION.scale],
    { ease: SCALP_STORY_MOTION.ease },
  )
  const introY = useTransform(scrollYProgress, [0, 0.24], [0, -34])
  const botanicalY = useTransform(scrollYProgress, [0.15, 0.24, 0.38, 0.48], [34, 0, 0, -34])
  const formatY = useTransform(scrollYProgress, [0.39, 0.49, 0.64, 0.74], [34, 0, 0, -34])
  const finalY = useTransform(scrollYProgress, [0.65, 0.76], [34, 0])

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const nextStep = getScrollStoryStep(value)
    if (nextStep === activeStepRef.current) return
    activeStepRef.current = nextStep
    setActiveStep(nextStep)
  })

  useEffect(() => {
    const image = new Image()
    image.src = product.storyImage ?? product.image
  }, [product])

  return (
    <section
      ref={sectionRef}
      className="scroll-story scroll-story--enhanced"
      aria-labelledby="scroll-story-title"
    >
      <div
        className="scroll-story__sticky"
        data-step={activeStep}
        style={{ '--story-tone': product.tint } as CSSProperties}
      >
        <div className="scroll-story__ambient" aria-hidden="true"><span /><span /><span /></div>
        <p className="scroll-story__ghost" aria-hidden="true">SKINFOX</p>

        <motion.div
          className="scroll-story__product-anchor"
          role="list"
          aria-label={`SkinFox ${product.name} product`}
          style={{ x: bottleX, y: bottleY }}
        >
          <motion.figure
            className={`scroll-story__product scroll-story__product--solo ${product.id === 'hydrelle-dry-skin-specialist' ? 'scroll-story__product--hydrelle' : ''}`}
            role="listitem"
            data-product-id={product.id}
            data-motion-path="pinned-chapters"
            style={{ rotate: bottleRotate, scale: bottleScale }}
          >
            <button type="button" onClick={() => onView(product)} aria-label={`View ${product.name} product details`}>
              <BottleAsset product={product} />
            </button>
          </motion.figure>
        </motion.div>

        <div className="scroll-story__chapters" role="list" aria-label={`SkinFox ${product.name} story`}>
          <motion.article
            className="scroll-story__chapter scroll-story__chapter--intro"
            role="listitem"
            data-active={activeStep === 0}
            style={{ y: introY }}
          >
            <span className="section-number">03 / Moisture in motion</span>
            <p className="eyebrow"><Sparkles size={13} /> Hydrelle · one continuous journey</p>
            <h2 id="scroll-story-title">Moisture.<br /><em>Made visible.</em></h2>
            <p>Scroll to carry the same Hydrelle tube from its dry-skin focus through format details and a final moisture moment.</p>
          </motion.article>

          <motion.article
            className="scroll-story__chapter scroll-story__chapter--left"
            role="listitem"
            data-active={activeStep === 1}
            style={{ y: botanicalY }}
          >
            <span className="scroll-story__chapter-number">01 / The care focus</span>
            <p className="eyebrow"><Droplets size={13} /> Dry-skin specialist</p>
            <h2>Made for<br /><em>dry-skin care.</em></h2>
            <p>The photographed front pack presents Hydrelle as a focused moisturising lotion for the dry-skin ritual.</p>
            <div className="scroll-story__ingredient-list" aria-label="Hydrelle care details">
              <span>Dry skin</span><span>Moisturising lotion</span><span>Skin + body</span>
            </div>
          </motion.article>

          <motion.article
            className="scroll-story__chapter scroll-story__chapter--right"
            role="listitem"
            data-active={activeStep === 2}
            style={{ y: formatY }}
          >
            <span className="scroll-story__chapter-number">02 / The format</span>
            <p className="eyebrow"><Sparkles size={13} /> A generous tube</p>
            <h2>A focused<br /><em>200 g ritual.</em></h2>
            <p>The navy-and-white tube gives Hydrelle a distinctive presence while keeping the format clear and easy to recognise.</p>
            <div className="scroll-story__fact-row"><span>200 g</span><span>Tube format</span><span>Body moisture</span></div>
          </motion.article>

          <motion.article
            className="scroll-story__chapter scroll-story__chapter--final"
            role="listitem"
            data-active={activeStep === 3}
            style={{ y: finalY }}
          >
            <span className="scroll-story__chapter-number">03 / Complete the journey</span>
            <p className="eyebrow"><Sparkles size={13} /> One Hydrelle tube, continuously present</p>
            <h2>A focused ritual.<br /><em>Beautifully SkinFox.</em></h2>
            <p>The same Hydrelle Dry Skin Specialist tube stays with you through every chapter—no product swaps and no visual jumps.</p>
            <div className="scroll-story__actions">
              <button className="button button--light" type="button" onClick={() => onView(product)}>
                Explore Hydrelle <ArrowRight size={16} />
              </button>
              <a className="button scroll-story__shop-link" href="#shop">View all products</a>
            </div>
          </motion.article>
        </div>

        <div className="scroll-story__chrome" aria-hidden="true">
          <span>Scroll · guide the tube</span>
          <div className="scroll-story__rail"><motion.i style={{ scaleX: scrollYProgress }} /></div>
          <span>{String(activeStep + 1).padStart(2, '0')} / 04</span>
        </div>

        <ol className="scroll-story__steps" aria-hidden="true">
          {['Origin', 'Botanicals', 'Format', 'Ritual'].map((label, index) => (
            <li className={activeStep === index ? 'is-active' : ''} key={label}>
              <span>{String(index + 1).padStart(2, '0')}</span>{label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
