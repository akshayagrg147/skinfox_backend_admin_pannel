/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Instagram,
  Leaf,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { CartDrawer } from './components/CartDrawer'
import { BrandMark } from './components/BrandMark'
import { CampaignSlideshow } from './components/CampaignSlideshow'
import { CheckoutModal } from './components/CheckoutModal'
import { CustomerAccount, type StorefrontCustomer } from './components/CustomerAccount'
import { Header } from './components/Header'
import { HeroCollectionShowcase } from './components/HeroCollectionShowcase'
import { HydrelleRoutineComparison } from './components/HydrelleRoutineComparison'
import { LegalPage, type LegalPageKind } from './components/LegalPage'
import { ProductCard } from './components/ProductCard'
import { ProductVisual } from './components/ProductVisual'
import { QuickView } from './components/QuickView'
import { RoutineQuiz } from './components/RoutineQuiz'
import { ScrollProductStory } from './components/ScrollProductStory'
import { SearchOverlay } from './components/SearchOverlay'
import { formatProductPrice, getProductById, products } from './data/products'
import type { CartLine, Product } from './types'
import { deleteStorefront, getStorefront, patchStorefront, postStorefront } from './lib/storefrontApi'
import { mapProduct, useStorefront } from './hooks/useStorefront'

const rangeNotes = [
  {
    name: 'Protect & cleanse',
    eyebrow: 'Rayyvia + Acnfin Soft',
    text: 'The skin edit moves from a bright 60 g facial suncream to a focused 100 g foaming face-wash format.',
    product: 'Sun Protect + Acnfin Soft',
    tone: '#e7bd43',
  },
  {
    name: 'Moisture care',
    eyebrow: 'Coco Kiss + Hydrelle',
    text: 'Two distinct moisture formats pair a compact 100 ml pump with Hydrelle’s generous 200 g dry-skin tube.',
    product: 'Coco Kiss + Hydrelle',
    tone: '#dba9c7',
  },
  {
    name: 'Hair cleanse',
    eyebrow: 'Onion Shampoo · 300 ml',
    text: 'The hair-wash format is photographed as an amber pump shampoo with onion, aloe vera, hibiscus and rosemary named on the pack.',
    product: 'Onion Shampoo',
    tone: '#e2a0b6',
  },
  {
    name: 'Scalp & oil',
    eyebrow: 'Treatment + Onion Hair Oil',
    text: 'A clear 250 ml herb treatment and a 200 ml botanical oil give scalp and regular hair-care rituals separate identities.',
    product: 'Scalp Treatment + Hair Oil',
    tone: '#b88d67',
  },
]

const faqs = [
  ['Are these the actual SkinFox products?', 'Yes. All seven current catalogue entries and their galleries use the supplied SkinFox photography. Any MRP visible on pack or campaign artwork is labelled as such; selling prices, complete ingredients, directions and approved claims still need final brand confirmation.'],
  ['Does the ritual finder diagnose skin conditions?', 'No. It offers cosmetic product-discovery guidance only. Persistent, painful or concerning symptoms should be discussed with a qualified dermatologist.'],
  ['How are the product visuals presented?', 'Every shopping surface uses the supplied SkinFox pack photography. The hero and shop present the wider collection, while the motion chapter gives the Hydrelle Dry Skin Specialist tube one uninterrupted scroll-led close-up.'],
  ['When will orders open?', 'This is a launch preview while selling prices and final pack details are being confirmed. No payment is taken yet.'],
]

function readInitialCart(): CartLine[] {
  if (import.meta.env.MODE !== 'test') return []
  try {
    const stored = localStorage.getItem('skinfox-launch-cart-v2')
    if (!stored) return []
    const parsed = JSON.parse(stored) as Array<{ id: string; quantity: number }>
    return parsed.flatMap((line) => {
      const product = products.find((item) => item.id === line.id)
      return product ? [{ product, quantity: Math.max(1, Math.min(8, line.quantity)) }] : []
    })
  } catch {
    return []
  }
}

function readLegalPageFromHash(): LegalPageKind | null {
  if (window.location.hash === '#privacy-policy') return 'privacy'
  if (window.location.hash === '#terms-and-conditions') return 'terms'
  return null
}

export default function App() {
  const storefront = useStorefront()
  const collectionProducts = storefront.products.length ? storefront.products : (import.meta.env.MODE === 'test' ? products : [])
  const productById = (id: string) => collectionProducts.find((item) => item.id === id) ?? getProductById(id)
  const activeHydrelle = productById('hydrelle-dry-skin-specialist')
  const activeScalpTreatment = productById('intensive-scalp-hair-treatment')
  const activeRayyvia = productById('rayyvia-sun-protect')
  const activeCoco = productById('coco-kiss-moisturizing-lotion')
  const activeAcnfin = productById('acnfin-soft-face-wash')
  const activeRitualStages = [
    { number: '01', label: 'Daily protect', product: activeRayyvia, copy: 'A bright 60 g tube for the daily facial sun-protection shelf.' },
    { number: '02', label: 'Face cleanse', product: activeAcnfin, copy: 'A 100 g foaming wash format for an acne-prone skin ritual.' },
    { number: '03', label: 'Gentle moisture', product: activeCoco, copy: 'A compact 100 ml pump lotion for dry and ultra-dry skin.' },
    { number: '04', label: 'Scalp ritual', product: activeScalpTreatment, copy: 'A transparent 250 ml treatment bottle with visible botanicals.' },
  ]
  const filters = ['All', ...Array.from(new Set(collectionProducts.flatMap((product) => product.concerns.filter((concern) => !['Skin', 'Hair'].includes(concern)))))]
  const [cart, setCart] = useState<CartLine[]>(readInitialCart)
  const [cartToken, setCartToken] = useState(() => import.meta.env.MODE === 'test' ? '' : localStorage.getItem('skinfox-cart-token') ?? '')
  const [cartOpen, setCartOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeIngredient, setActiveIngredient] = useState(0)
  const [activeRitual, setActiveRitual] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [toast, setToast] = useState('')
  const [legalPage, setLegalPage] = useState<LegalPageKind | null>(readLegalPageFromHash)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 })
  const heroY = useTransform(scrollYProgress, [0, 0.16], [0, 80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0.35])

  useEffect(() => {
    if (!storefront.apiMode || !cartToken) return
    getStorefront<any>(`/carts/${cartToken}`).then((response) => setCart((response.lines ?? []).map((line: any) => ({ product: mapProduct(line.product), quantity: line.quantity })))).catch(() => undefined)
  }, [cartToken, storefront.apiMode])

  useEffect(() => {
    if (!storefront.apiMode) return
    void getStorefront<{ customer: StorefrontCustomer | null }>('/customer/auth/me').then(({ customer: signedInCustomer }) => setCustomer(signedInCustomer)).catch(() => undefined)
  }, [storefront.apiMode])

  useEffect(() => {
    if (!storefront.apiMode) return
    const referralCode = new URL(window.location.href).searchParams.get('ref')?.trim().toUpperCase()
    if (!referralCode) return
    localStorage.setItem('skinfox-affiliate-referral', referralCode)
    void postStorefront('/affiliate/referrals/track', { code: referralCode, landingPath: `${window.location.pathname}${window.location.search}` }).catch(() => undefined)
  }, [storefront.apiMode])

  useEffect(() => {
    if (storefront.apiMode) return
    localStorage.setItem(
      'skinfox-launch-cart-v2',
      JSON.stringify(cart.map((line) => ({ id: line.product.id, quantity: line.quantity }))),
    )
  }, [cart])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const syncLegalPage = () => {
      const nextLegalPage = readLegalPageFromHash()
      setLegalPage(nextLegalPage)
      if (nextLegalPage) window.scrollTo({ top: 0, behavior: 'auto' })
    }
    window.addEventListener('hashchange', syncLegalPage)
    return () => window.removeEventListener('hashchange', syncLegalPage)
  }, [])

  useEffect(() => {
    activeRitualStages.forEach(({ product }) => {
      const image = new Image()
      image.src = product.image
    })
  }, [activeRitualStages])

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const visibleProducts = activeFilter === 'All'
    ? collectionProducts
    : collectionProducts.filter((product) => product.concerns.includes(activeFilter))

  const applyCartResponse = (response: any) => setCart((response.lines ?? []).map((line: any) => ({ product: mapProduct(line.product), quantity: line.quantity })))
  const trackAffiliateReferral = async (token: string) => {
    const referralCode = localStorage.getItem('skinfox-affiliate-referral')
    if (!referralCode || localStorage.getItem('skinfox-affiliate-referral-cart') === token) return
    await postStorefront('/affiliate/referrals/track', { code: referralCode, landingPath: `${window.location.pathname}${window.location.search}` }, { 'x-cart-token': token })
    localStorage.setItem('skinfox-affiliate-referral-cart', token)
  }
  useEffect(() => {
    if (!storefront.apiMode || !cartToken) return
    void trackAffiliateReferral(cartToken).catch(() => undefined)
  }, [cartToken, storefront.apiMode])
  const ensureCartToken = async () => {
    if (cartToken) return cartToken
    const response = await postStorefront<any>('/carts', {})
    const token = response.token ?? response.cartId
    setCartToken(token)
    localStorage.setItem('skinfox-cart-token', token)
    return token
  }
  const addToCart = (product: Product, quantity = 1, openCart = false) => {
    if (storefront.apiMode) {
      void ensureCartToken().then((token) => postStorefront<any>(`/carts/${token}/items`, { productId: product.id, quantity }, { 'x-cart-token': token })).then(applyCartResponse).then(() => { setToast(`${product.name} added to your edit`); if (openCart) setCartOpen(true) }).catch((cause: unknown) => setToast(cause instanceof Error ? cause.message : 'Unable to update your bag'))
      return
    }
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: Math.min(8, line.quantity + quantity) } : line,
        )
      }
      return [...current, { product, quantity: Math.min(8, quantity) }]
    })
    setToast(`${product.name} added to your edit`)
    if (openCart) window.setTimeout(() => setCartOpen(true), 80)
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (storefront.apiMode && cartToken) {
      const line = cart.find((item) => item.product.id === id)
      if (!line) return
      void (quantity <= 0 ? deleteStorefront<any>(`/carts/${cartToken}/items/${id}`, { 'x-cart-token': cartToken }) : patchStorefront<any>(`/carts/${cartToken}/items/${id}`, { quantity }, { 'x-cart-token': cartToken })).then(applyCartResponse).catch((cause: unknown) => setToast(cause instanceof Error ? cause.message : 'Unable to update your bag'))
      return
    }
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.product.id !== id))
      return
    }
    setCart((current) => current.map((line) => (line.product.id === id ? { ...line, quantity: Math.min(8, quantity) } : line)))
  }

  const newsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (storefront.apiMode) { const form = event.currentTarget; const email = String(new FormData(form).get('email') ?? ''); void postStorefront('/newsletter/subscriptions', { email }).then(() => { form.reset(); setToast('Check your inbox to confirm The Skin Letter') }).catch((cause: unknown) => setToast(cause instanceof Error ? cause.message : 'Unable to subscribe')); return }
    event.currentTarget.reset()
    setToast('Welcome to The Skin Letter')
  }

  const returnToStore = () => {
    setLegalPage(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#top`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (legalPage) return <LegalPage kind={legalPage} onBack={returnToStore} />

  return (
    <div id="top" className="app-shell">
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />
      <div className="announcement">
        <span>New collection preview</span>
        <p>Skin · body · hair · scalp care</p>
        <span>India · INR</span>
      </div>
      {storefront.error && (
        <div className="api-error-banner" role="alert">
          <span>Live catalogue unavailable: {storefront.error}</span>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} onQuiz={() => setQuizOpen(true)} onSearch={() => setSearchOpen(true)} onAccount={() => setAccountOpen(true)} customerName={customer?.fullName} />

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__wash" />
          <div className="hero__grain" />
          <motion.div className="hero__copy" style={{ y: heroY, opacity: heroOpacity }}>
            <span className="eyebrow hero__eyebrow"><Sparkles size={14} /> The SkinFox launch collection</span>
            <h1 id="hero-title">Care for every ritual.<br /><em>Beautifully SkinFox.</em></h1>
            <p>A growing edit of skin, body, hair and scalp care—distinct products, connected by one expressive SkinFox point of view.</p>
            <div className="hero__actions">
              <a className="button button--copper" href="#shop">Shop the collection <ArrowDown size={16} /></a>
              <button className="button button--ghost" onClick={() => setQuizOpen(true)}>Find my care <ArrowRight size={17} /></button>
            </div>
          </motion.div>
          <HeroCollectionShowcase products={collectionProducts} onView={setSelectedProduct} />
        </section>

        <section className="proof-strip" aria-label="SkinFox principles">
          <div className="shell proof-strip__inner">
            <p><TestTube2 size={18} /><span><strong>{collectionProducts.length} photographed formats</strong><small>Skin, body, hair and scalp care in one launch edit.</small></span></p>
            <p><ShieldCheck size={18} /><span><strong>Clear by design</strong><small>Pack information is presented simply and without noise.</small></span></p>
            <p><Leaf size={18} /><span><strong>Root-to-skin care</strong><small>A concise edit for the care moments you choose.</small></span></p>
          </div>
        </section>

        <CampaignSlideshow slides={storefront.campaigns.length ? storefront.campaigns.map((slide) => ({ id: slide.id, kind: slide.kind, src: slide.desktopSrc, mobileSrc: slide.mobileSrc, poster: slide.poster, orientation: 'landscape' as const, durationMs: slide.durationMs, eyebrow: slide.textOverlay?.eyebrow ?? '', title: slide.textOverlay?.title ?? 'Daily care, in motion.', description: slide.textOverlay?.description ?? '', alt: slide.alt })) : undefined} />

        <section id="shop" className="collection section-pad">
          <div className="shell">
            <div className="section-heading collection__heading">
              <div>
                <span className="section-number">02 / The launch edit</span>
                <h2>The launch<br /><em>collection.</em></h2>
              </div>
              <p>Explore every photographed SkinFox product in the current edit. New launch products can join the same collection automatically as their approved details arrive.</p>
            </div>
            <div className="filter-row" aria-label="Filter products by concern">
              {filters.map((filter) => (
                <button key={filter} className={activeFilter === filter ? 'is-active' : ''} onClick={() => setActiveFilter(filter)}>
                  {filter}<span>{filter === 'All' ? collectionProducts.length : collectionProducts.filter((product) => product.concerns.includes(filter)).length}</span>
                </button>
              ))}
            </div>
            <motion.div className="product-grid" layout role="list" aria-label="SkinFox product collection">
              <AnimatePresence mode="popLayout">
                {visibleProducts.map((product) => (
                  <motion.div key={product.id} layout role="listitem" data-product-id={product.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                    <ProductCard product={product} index={collectionProducts.indexOf(product)} onView={setSelectedProduct} onAdd={(item) => addToCart(item, 1, true)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>

        <ScrollProductStory product={activeHydrelle} onView={setSelectedProduct} />

        <HydrelleRoutineComparison product={activeHydrelle} onView={setSelectedProduct} />

        <section id="ingredients" className="ingredient-section section-pad">
          <div className="ingredient-section__grain" />
          <div className="shell ingredient-layout">
            <div className="ingredient-copy">
              <span className="section-number section-number--light">04 / Across the range</span>
              <p className="eyebrow">{rangeNotes[activeIngredient].eyebrow}</p>
              <AnimatePresence mode="wait">
                <motion.div key={rangeNotes[activeIngredient].name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
                  <h2>{rangeNotes[activeIngredient].name}</h2>
                  <p>{rangeNotes[activeIngredient].text}</p>
                  <span>Photographed pack note · {rangeNotes[activeIngredient].product}</span>
                </motion.div>
              </AnimatePresence>
              <div className="ingredient-tabs">
                {rangeNotes.map((note, index) => <button key={note.name} className={activeIngredient === index ? 'is-active' : ''} onClick={() => setActiveIngredient(index)}>{String(index + 1).padStart(2, '0')} <span>{note.name}</span></button>)}
              </div>
            </div>
            <div className="ingredient-art" style={{ '--ingredient-tone': rangeNotes[activeIngredient].tone } as React.CSSProperties} aria-hidden="true">
              <motion.div className="ingredient-orb ingredient-orb--main" animate={{ backgroundColor: rangeNotes[activeIngredient].tone }} transition={{ duration: 0.6 }}><span>{rangeNotes[activeIngredient].name.slice(0, 2).toUpperCase()}</span></motion.div>
              <div className="ingredient-orb ingredient-orb--small" />
              <div className="ingredient-ring" />
              <span className="ingredient-art__formula">SKN / 0{activeIngredient + 1}</span>
            </div>
          </div>
        </section>

        <section className="ritual-section section-pad" aria-labelledby="ritual-section-title">
          <div className="shell">
            <div className="section-heading ritual-section__heading">
              <div><span className="section-number">05 / Choose your care</span><h2 id="ritual-section-title">Explore by<br /><em>care moment.</em></h2></div>
              <div className="ritual-section__intro">
                <p>Move between four skin-first care moments here, then explore all seven photographed products in the complete shop.</p>
                <span><Sparkles size={14} /> 04 curated pathways</span>
              </div>
            </div>
            <div
              className="ritual-stage"
              style={
                {
                  '--ritual-accent': activeRitualStages[activeRitual].product.accent,
                  '--ritual-surface': activeRitualStages[activeRitual].product.tint,
                } as React.CSSProperties
              }
            >
              <div className="ritual-stage__canvas" id="ritual-product-panel" role="region" aria-live="polite" aria-atomic="true">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`number-${activeRitualStages[activeRitual].number}`}
                    className="ritual-stage__ghost-number"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    transition={{ duration: 0.5 }}
                    aria-hidden="true"
                  >
                    {activeRitualStages[activeRitual].number}
                  </motion.span>
                </AnimatePresence>
                <div className="ritual-stage__topline" aria-hidden="true">
                  <span>SkinFox care edit</span>
                  <span>{activeRitualStages[activeRitual].number} / 04</span>
                </div>
                <span className="ritual-stage__orbit" aria-hidden="true" />
                <div className="ritual-stage__media">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeRitualStages[activeRitual].product.id}
                      className="ritual-stage__photo"
                      src={activeRitualStages[activeRitual].product.image}
                      alt={activeRitualStages[activeRitual].product.imageAlt}
                      initial={{ opacity: 0, scale: 1.02, x: 12 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.99, x: -10 }}
                      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </AnimatePresence>
                  <span>SkinFox pack · {activeRitualStages[activeRitual].product.size}</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`caption-${activeRitualStages[activeRitual].label}`}
                    className="ritual-stage__caption"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                  >
                    <span>{activeRitualStages[activeRitual].product.category}</span>
                    <strong>{activeRitualStages[activeRitual].label}</strong>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="ritual-stage__controls">
                {activeRitualStages.map((stage, index) => (
                  <button type="button" key={stage.label} className={activeRitual === index ? 'is-active' : ''} onClick={() => setActiveRitual(index)} aria-pressed={activeRitual === index} aria-controls="ritual-product-panel">
                    <span>{stage.number}</span><strong>{stage.label}</strong><small>{stage.product.name}</small><ArrowRight size={17} /><i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div className="ritual-stage__detail" key={activeRitual} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                  <span className="eyebrow">{activeRitualStages[activeRitual].product.usage}</span>
                  <h3>{activeRitualStages[activeRitual].product.name}</h3>
                  <p>{activeRitualStages[activeRitual].copy}</p>
                  <button onClick={() => addToCart(activeRitualStages[activeRitual].product, 1, true)}>Add to launch bag · {formatProductPrice(activeRitualStages[activeRitual].product)} <ArrowRight size={15} /></button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        <section className="quiz-invite section-pad shell">
          <div className="quiz-invite__panel">
            <div className="quiz-invite__art" aria-hidden="true">
              <img className="quiz-invite__art-main" src={activeAcnfin.image} alt="" />
              <img className="quiz-invite__art-accent" src={activeRayyvia.image} alt="" />
              <span>Find your SkinFox format</span>
            </div>
            <div className="quiz-invite__copy">
              <span className="section-number">06 / Your care, translated</span>
              <p className="eyebrow"><Sparkles size={13} /> 60-second ritual finder</p>
              <h2>A better match starts<br /><em>with listening.</em></h2>
              <p>Tell us whether you are shopping for sun protection, face or hair cleansing, gentle moisture, dry-skin care, scalp care or oiling. We will find a focused starting point.</p>
              <button className="button button--dark" onClick={() => setQuizOpen(true)}>Begin the ritual finder <ArrowRight size={17} /></button>
            </div>
          </div>
        </section>

        <section className="reviews section-pad">
          <div className="shell">
            <div className="reviews__heading"><span className="section-number">07 / Collection notes</span><h2>Meet the range<br /><em>beyond the shelf.</em></h2><p>Distinctive products, connected by one approachable SkinFox point of view.</p></div>
            <div className="review-grid">
              {[
                ['“Navy, white and blush make focused dry-skin care feel graphic and distinctive.”', 'Dry-skin care', 'Hydrelle'],
                ['“A blush carton and amber pump give the everyday hair-wash shelf a softer point of view.”', 'Hair cleanse', 'Onion Shampoo'],
                ['“Visible botanicals and warm glass turn scalp care into the collection’s slowest moment.”', 'Scalp ritual', 'Intensive Scalp & Hair Treatment'],
                ['“Amber glass and purple detailing give the hair-oiling ritual its own visual identity.”', 'Hair ritual', 'Onion Hair Oil'],
              ].map(([quote, note, product], index) => (
                <motion.article key={`${note}-${product}`} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                  <div className="review-stars"><span>Product note</span></div>
                  <blockquote>{quote}</blockquote>
                  <div><p>{note}</p><span>{product}</span></div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="story" className="story section-pad">
          <div className="story__art">
            <span className="story__fox">FOX</span>
            <div className="story__collection" role="list" aria-label="SkinFox care collection">
              {collectionProducts.map((product) => (
                <div key={product.id} role="listitem" data-product-id={product.id}>
                  <ProductVisual product={product} compact />
                </div>
              ))}
            </div>
            <span className="story__note">Skin, body, hair and scalp.<br />Still clearly SkinFox.</span>
          </div>
          <div className="story__copy">
            <span className="section-number">08 / Why SkinFox</span>
            <h2>One collection.<br />More ways to <em>care.</em></h2>
            <p>Each photographed formula has a distinct role, pack language and care moment. Together they build a wider SkinFox collection across skin, body, hair and scalp.</p>
            <p>All seven supplied launch products now have a place in the collection. Visible MRP references are kept separate from selling prices while complete ingredients, directions and substantiated claims await final approval.</p>
            <span className="story__signature">SkinFox / Care, clearly considered.</span>
          </div>
        </section>

        <section id="faq" className="faq section-pad shell">
          <div className="faq__heading"><span className="section-number">09 / Questions, answered</span><h2>Clarity belongs<br /><em>in the ritual.</em></h2></div>
          <div className="faq__list">
            {(storefront.faqs.length ? storefront.faqs.map((item) => [item.question, item.answer] as [string, string]) : faqs).map(([question, answer], index) => (
              <article key={question} className={openFaq === index ? 'is-open' : ''}>
                <button onClick={() => setOpenFaq((value) => (value === index ? null : index))} aria-expanded={openFaq === index}>
                  <span>{String(index + 1).padStart(2, '0')}</span><strong>{question}</strong><ChevronDown size={18} />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === index && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><p>{answer}</p></motion.div>}
                </AnimatePresence>
              </article>
            ))}
          </div>
        </section>

        <section className="newsletter section-pad">
          <div className="shell newsletter__inner">
            <div><span className="eyebrow">The Skin Letter · Issue 00</span><h2>Better rituals,<br /><em>delivered slowly.</em></h2></div>
            <form onSubmit={newsletter}>
              <label><span className="sr-only">Email address</span><input type="email" required placeholder="Your email address" /><button aria-label="Join The Skin Letter"><ArrowRight size={20} /></button></label>
              <p>Thoughtful routines, ingredient notes and launch stories. No noise.</p>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__top">
          <div><div className="site-footer__logo"><BrandMark /></div><p>Beautiful care from root to skin.</p></div>
          <div><span>Explore</span><a href="#shop">Shop all</a><button onClick={() => setQuizOpen(true)}>Care finder</button><a href="#ingredients">On the label</a></div>
          <div><span>Help</span><a href="#faq">FAQ</a><a href="#faq">Shipping & returns</a><a href="mailto:contact@skinfox.in">Contact</a><a href="#privacy-policy">Privacy policy</a><a href="#terms-and-conditions">Terms & conditions</a></div>
          <div><span>Follow</span><a href="#story"><Instagram size={15} /> Instagram</a><a href="#story">Journal</a></div>
        </div>
        <div className="shell site-footer__bottom"><p>© 2026 SkinFox launch preview</p><p>Actual product photography · Selling prices pending · No live payments</p><a href="#top">Back to top ↑</a></div>
        <img className="site-footer__wordmark" src="/brand/skinfox-logo.png" alt="" aria-hidden="true" />
      </footer>

      <QuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(product, quantity) => addToCart(product, quantity, true)} />
      <CartDrawer open={cartOpen} lines={cart} onClose={() => setCartOpen(false)} onQuantity={updateQuantity} onRemove={(id) => updateQuantity(id, 0)} onCheckout={() => setCheckoutOpen(true)} />
      <RoutineQuiz open={quizOpen} onClose={() => setQuizOpen(false)} onAdd={(product) => addToCart(product)} catalogue={collectionProducts} finder={storefront.careFinder ?? undefined} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onView={setSelectedProduct} catalogue={collectionProducts} apiMode={storefront.apiMode} />
      <CheckoutModal open={checkoutOpen} lines={cart} cartToken={cartToken} onCustomerChange={setCustomer} onClose={() => setCheckoutOpen(false)} onComplete={() => { setCart([]); if (cartToken) localStorage.removeItem('skinfox-cart-token'); setCartToken('') }} />
      <CustomerAccount open={accountOpen} onClose={() => setAccountOpen(false)} apiAvailable={storefront.apiMode} onCustomerChange={setCustomer} />

      <AnimatePresence>
        {toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><Check size={16} /> {toast}</motion.div>}
      </AnimatePresence>
    </div>
  )
}
