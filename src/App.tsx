/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  HeartHandshake,
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
import { CustomerAccount, type AccountSection, type StorefrontCustomer } from './components/CustomerAccount'
import { Header } from './components/Header'
import { HeroCollectionShowcase } from './components/HeroCollectionShowcase'
import { CareGuide } from './components/CareGuide'
import { ProductPage } from './seo/ProductPage'
import { SiteSeo } from './seo/SiteSeo'
import { defaultFaqs } from './seo/content'
import { HydrelleRoutineComparison } from './components/HydrelleRoutineComparison'
import { LegalPage, type LegalPageKind } from './components/LegalPage'
import { ProductCard } from './components/ProductCard'
import { QuickView } from './components/QuickView'
import { RoutineQuiz } from './components/RoutineQuiz'
import { ScrollProductStory } from './components/ScrollProductStory'
import { SearchOverlay } from './components/SearchOverlay'
import { WaitlistModal } from './components/WaitlistModal'
import { getProductById, products } from './data/products'
import type { CartLine, Product } from './types'
import { deleteStorefront, getStorefront, patchStorefront, postStorefront } from './lib/storefrontApi'
import { consumeGoogleRedirect, exchangeFirebaseUser, firebaseAuthConfigured, signOutFirebase } from './lib/firebaseAuth'
import { mapProduct, useStorefront } from './hooks/useStorefront'

/* Care ranges group the live catalogue by concern, so the range grid stays in
   step with whatever the storefront API returns. */
const careRangeDefinitions = [
  { title: 'Skin', copy: 'Daily facial sun protection and a focused foaming cleanse.', concerns: ['Sun Protection', 'Face Wash', 'Acne & Oily Skin'] },
  { title: 'Body', copy: 'Generous everyday moisture for dry and ultra-dry skin.', concerns: ['Dry Skin', 'Gentle Moisture'] },
  { title: 'Hair', copy: 'A gentle regular wash and a botanical oil-led ritual.', concerns: ['Hair Wash', 'Hair Oil'] },
  { title: 'Scalp', copy: 'A slower scalp and hair treatment with visible botanicals.', concerns: ['Scalp Care'] },
]

const legacyFaqQuestions = new Set(['Are these the actual SkinFox products?', 'Does the ritual finder diagnose skin conditions?', 'How are the product visuals presented?', 'When will orders open?'])

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
  if (typeof window === 'undefined') return null
  if (window.location.hash === '#privacy-policy') return 'privacy'
  if (window.location.hash === '#terms-and-conditions') return 'terms'
  return null
}

export default function App({ productSlug }: { productSlug?: string } = {}) {
  const storefront = useStorefront()
  const collectionProducts = storefront.products.length ? storefront.products : (import.meta.env.MODE === 'test' ? products : [])
  const productById = (id: string) => collectionProducts.find((item) => item.id === id) ?? getProductById(id)
  const activeHydrelle = productById('hydrelle-dry-skin-specialist')
  const careRanges = careRangeDefinitions
    .map((range) => ({ ...range, products: collectionProducts.filter((product) => product.concerns.some((concern) => range.concerns.includes(concern))) }))
    .filter((range) => range.products.length > 0)
  const filters = ['All', ...Array.from(new Set(collectionProducts.flatMap((product) => product.concerns.filter((concern) => !['Skin', 'Hair'].includes(concern)))))]
  const [cart, setCart] = useState<CartLine[]>(readInitialCart)
  const [cartToken, setCartToken] = useState(() => import.meta.env.MODE === 'test' || typeof localStorage === 'undefined' ? '' : localStorage.getItem('skinfox-cart-token') ?? '')
  const [cartOpen, setCartOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountSection, setAccountSection] = useState<AccountSection>('orders')
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [toast, setToast] = useState('')
  const [legalPage, setLegalPage] = useState<LegalPageKind | null>(readLegalPageFromHash)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 })

  useEffect(() => {
    if (!storefront.apiMode || !cartToken) return
    getStorefront<any>(`/carts/${cartToken}`).then((response) => setCart((response.lines ?? []).map((line: any) => ({ product: mapProduct(line.product), quantity: line.quantity })))).catch(() => undefined)
  }, [cartToken, storefront.apiMode])

  useEffect(() => {
    if (!storefront.apiMode) return
    void getStorefront<{ customer: StorefrontCustomer | null }>('/customer/auth/me').then(({ customer: signedInCustomer }) => setCustomer(signedInCustomer)).catch(() => undefined)
  }, [storefront.apiMode])

  useEffect(() => {
    if (!storefront.apiMode || !firebaseAuthConfigured) return
    let active = true
    void consumeGoogleRedirect().then(async (pending) => {
      if (!pending || !active) return
      const response = await exchangeFirebaseUser<{ customer: StorefrontCustomer }>(pending.credential.user, pending.intent.cartToken)
      if (!active) return
      setCustomer(response.customer)
      if (pending.intent.destination === 'checkout') setCheckoutOpen(true)
      else if (pending.intent.destination === 'waitlist') setWaitlistOpen(true)
      else setAccountOpen(true)
    }).catch(() => {
      if (active) setToast('Google sign-in could not be completed. Please try again.')
    })
    return () => { active = false }
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

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const visibleProducts = activeFilter === 'All'
    ? collectionProducts
    : collectionProducts.filter((product) => product.concerns.includes(activeFilter))
  const customFaqs = storefront.faqs.filter((item) => !legacyFaqQuestions.has(item.question))
  const visibleFaqs = (customFaqs.length ? customFaqs : defaultFaqs).map((item) => [item.question, item.answer] as [string, string])

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
      void ensureCartToken().then((token) => postStorefront<any>(`/carts/${token}/items`, { productId: product.id, quantity }, { 'x-cart-token': token })).then((response) => { applyCartResponse(response); const issue = Array.isArray(response.validationMessages) ? response.validationMessages[0] : ''; if (issue) throw new Error(issue); return response }).then(() => { setToast(`${product.name} added to your edit`); if (openCart) setCartOpen(true) }).catch((cause: unknown) => setToast(cause instanceof Error ? cause.message : 'Unable to update your bag'))
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

  const openAccount = (section: AccountSection = 'profile') => { setAccountSection(section); setAccountOpen(true) }
  const logoutCustomer = async () => {
    try {
      const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
      await postStorefront('/customer/auth/logout', {}, csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {})
    } catch { /* Signing out locally is still safe if the API is unavailable. */ }
    await signOutFirebase().catch(() => undefined)
    setCustomer(null)
    setAccountOpen(false)
    setToast('You have been signed out.')
  }

  if (legalPage) return <LegalPage kind={legalPage} onBack={returnToStore} />

  return (
    <div id="top" className="app-shell">
      {!productSlug && <SiteSeo faqs={visibleFaqs.map(([question, answer]) => ({ question, answer }))} />}
      <a className="skip-link" href="#main-content">Skip to content</a>
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />
      <div className="announcement">
        <span>Priority waitlist open · refundable access</span>
        <p>Skin · body · hair · scalp care</p>
        <span>India · INR</span>
      </div>
      {storefront.error && (
        <div className="api-error-banner" role="alert">
          <span>We’re having trouble loading the collection. Please try again.</span>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} onQuiz={() => setQuizOpen(true)} onSearch={() => setSearchOpen(true)} onAccount={openAccount} onLogout={() => void logoutCustomer()} customerName={customer?.fullName} />

      <main id="main-content" tabIndex={-1}>
        {productSlug ? <ProductPage product={collectionProducts.find((product) => product.id === productSlug)} productSlug={productSlug} catalogProducts={collectionProducts} loading={storefront.loading} error={storefront.error} onAdd={(product, quantity) => addToCart(product, quantity, true)} onFindCare={() => setQuizOpen(true)} /> : <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__wash" aria-hidden="true" />
          <div className="hero__copy">
            <span className="eyebrow hero__eyebrow"><Leaf size={16} /> Skin, body, hair & scalp</span>
            <h1 id="hero-title">Thoughtful care.<br /><em>For every day.</em></h1>
            <p>Discover skincare, body care and hair essentials that fit your everyday routine. A little guidance. A simpler choice. Care that feels like you.</p>
            <div className="hero__actions">
              <a className="button button--copper" href="#shop">Shop the collection <ArrowDown size={16} /></a>
              <button className="button button--ghost" onClick={() => setQuizOpen(true)}>Find my care <ArrowRight size={17} /></button>
            </div>
            <div className="hero__reassurance"><span><Check size={15} /> Care for your routine</span><span><Check size={15} /> Clear product details</span></div>
          </div>
          <HeroCollectionShowcase products={collectionProducts} onView={setSelectedProduct} loading={storefront.loading} />
        </section>

        <section className="proof-strip" aria-label="SkinFox principles">
          <div className="shell proof-strip__inner">
            <p><TestTube2 size={22} /><span><strong>Care with a purpose</strong><small>Everyday essentials for skin, body, hair and scalp.</small></span></p>
            <p><ShieldCheck size={22} /><span><strong>Clarity at every step</strong><small>Explore product details now and review the final price before purchase.</small></span></p>
            <p><HeartHandshake size={22} /><span><strong>A helping hand</strong><small>Find your routine with our guided care finder.</small></span></p>
          </div>
        </section>

        <CampaignSlideshow slides={storefront.campaigns.length ? storefront.campaigns.map((slide) => ({ id: slide.id, kind: slide.kind, src: slide.desktopSrc, mobileSrc: slide.mobileSrc, poster: slide.poster, orientation: 'landscape' as const, durationMs: slide.durationMs, eyebrow: slide.textOverlay?.eyebrow ?? '', title: slide.textOverlay?.title ?? 'Daily care, in motion.', description: slide.textOverlay?.description ?? '', alt: slide.alt })) : undefined} />

        <section id="shop" className="collection section-pad">
          <div className="shell">
            <div className="section-heading collection__heading">
              <div>
                <span className="section-number">Your everyday essentials</span>
                <h2>Find your kind<br /><em>of care.</em></h2>
              </div>
              <p>From a gentle cleanse to daily moisture, explore SkinFox skincare and hair care. Choose a concern to find a place to start.</p>
            </div>
            <div className="filter-row" aria-label="Filter products by concern">
              {filters.map((filter) => (
                <button type="button" key={filter} className={activeFilter === filter ? 'is-active' : ''} onClick={() => setActiveFilter(filter)} aria-pressed={activeFilter === filter}>
                  {filter}<span>{filter === 'All' ? collectionProducts.length : collectionProducts.filter((product) => product.concerns.includes(filter)).length}</span>
                </button>
              ))}
            </div>
            {storefront.loading && <div className="collection-loading" role="status"><span className="sr-only">Loading the SkinFox collection</span>{Array.from({ length: 4 }, (_, index) => <div className="product-skeleton" key={index} aria-hidden="true"><div /><span /><span /></div>)}</div>}
            {!storefront.loading && !visibleProducts.length && <div className="collection-empty" role="status"><Leaf size={28} /><h3>{storefront.error ? 'The collection will be back shortly.' : 'Let’s find another care option.'}</h3><p>{storefront.error ? 'Please refresh to load the latest products and prices.' : 'Try viewing the full collection or use Find my care for guidance.'}</p><button className="button button--ghost" onClick={() => storefront.error ? window.location.reload() : setActiveFilter('All')}>{storefront.error ? 'Try again' : 'View all products'}</button></div>}
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

        <section id="range" className="range-section section-pad" aria-labelledby="range-title">
          <div className="shell">
            <div className="range-section__intro" id="story">
              <span className="section-number">The SkinFox range</span>
              <h2 id="range-title">One collection.<br /><em>More ways to care.</em></h2>
              <p>Care is personal. SkinFox brings together skincare, body care and hair essentials, so you can build a routine around what matters to you. Clear product details, room to explore, and a helping hand whenever you need one.</p>
            </div>
            <div className="range-grid" role="list" aria-label="SkinFox care ranges">
              {careRanges.map((range) => (
                <article className="range-card" role="listitem" key={range.title}>
                  <div className="range-card__media" style={{ background: range.products[0].tint }}>
                    <img src={range.products[0].image} alt={range.products[0].imageAlt} width={640} height={640} loading="lazy" decoding="async" />
                  </div>
                  <div className="range-card__body">
                    <span className="range-card__meta">{range.products.length} {range.products.length === 1 ? 'product' : 'products'}</span>
                    <h3>{range.title}</h3>
                    <p>{range.copy}</p>
                    <ul className="range-card__links">
                      {range.products.map((product) => (
                        <li key={product.id}>
                          <a href={`/products/${encodeURIComponent(product.id)}`}>{product.name} <ArrowRight size={14} aria-hidden="true" /></a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="find-my-care" className="quiz-invite section-pad shell" aria-labelledby="care-invite-title">
          <div className="quiz-invite__panel">
            <div className="quiz-invite__art">
              <CareGuide variant="feature" />
            </div>
            <div className="quiz-invite__copy">
              <span className="section-number">Meet your SkinFox care guide</span>
              <p className="eyebrow"><Sparkles size={15} /> A little guidance, just for you</p>
              <h2 id="care-invite-title">Good care starts<br /><em>with listening.</em></h2>
              <p>Not sure where to start? Tell us about your skin, hair or scalp and the routine you have in mind. We’ll help you explore a considered care package, one simple question at a time.</p>
              <button className="button button--dark" onClick={() => setQuizOpen(true)}>Start Find my care <ArrowRight size={17} /></button>
              <small className="quiz-invite__disclosure">Product guidance, not a medical consultation.</small>
            </div>
          </div>
        </section>

        <section className="reviews section-pad">
          <div className="shell">
            <div className="reviews__heading"><span className="section-number">Small steps. Thoughtful routines.</span><h2>Make space<br /><em>for everyday care.</em></h2><p>A few simple starting points for a more considered routine.</p></div>
            <div className="review-grid">
              {[
                ['Explore a moisturising lotion when you want a focused moisture step for dry skin. Always follow the product directions.', 'Make room for moisture', 'Hydrelle'],
                ['Give your wash routine a clear starting point. Explore the format, pack size and product details before choosing.', 'Find your daily cleanse', 'Onion Shampoo'],
                ['Take a closer look at your scalp-care options and choose a format that suits your routine.', 'Care beyond the strands', 'Intensive Scalp & Hair Treatment'],
                ['Prefer an oil-led routine? Discover the pack details and follow the label for how and when to use it.', 'A moment for hair care', 'Onion Hair Oil'],
              ].map(([quote, note, product], index) => (
                <motion.article key={`${note}-${product}`} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                  <span className="care-note-number" aria-hidden="true">0{index + 1}</span>
                  <h3>{note}</h3>
                  <p>{quote}</p>
                  <span className="care-note-product">{product}</span>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="faq section-pad shell">
          <div className="faq__heading"><span className="section-number">Here to help</span><h2>Your questions.<br /><em>Clear answers.</em></h2><p>Need a hand with your order or routine?</p><a className="text-link" href="mailto:contact@skinfox.in">Talk to SkinFox <ArrowRight size={16} /></a></div>
          <div className="faq__list">
            {visibleFaqs.map(([question, answer], index) => (
              <article key={question} className={openFaq === index ? 'is-open' : ''}>
                <h3><button type="button" id={`faq-question-${index}`} onClick={() => setOpenFaq((value) => (value === index ? null : index))} aria-expanded={openFaq === index} aria-controls={`faq-answer-${index}`}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><strong>{question}</strong><ChevronDown size={18} />
                </button></h3>
                <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} hidden={openFaq !== index}><p>{answer}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="newsletter section-pad">
          <div className="shell newsletter__inner">
            <div><span className="eyebrow">The Skin Letter</span><h2>A little care<br /><em>in your inbox.</em></h2></div>
            <form onSubmit={newsletter}>
              <label><span className="sr-only">Email address</span><input name="email" type="email" autoComplete="email" required placeholder="Your email address" /><button aria-label="Join The Skin Letter"><ArrowRight size={20} /></button></label>
              <p>Product news and everyday care inspiration. Read our <a href="/privacy-policy">privacy policy</a>.</p>
            </form>
          </div>
        </section>
        </>}
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__top">
          <div><div className="site-footer__logo"><BrandMark /></div><p>Beautiful care from root to skin.</p></div>
          <div><span>Explore</span><a href="/#shop">Shop all products</a><button onClick={() => setQuizOpen(true)}>Find my care</button><a href="/#range">Explore the range</a><a href="/#story">Our story</a></div>
          <div><span>Customer care</span><button onClick={() => openAccount('orders')}>My orders</button><a href="/#faq">Frequently asked questions</a><a href="/terms-and-conditions#delivery">Shipping & returns</a><a href="mailto:contact@skinfox.in">contact@skinfox.in</a></div>
          <div><span>Good to know</span><a href="/privacy-policy">Privacy policy</a><a href="/terms-and-conditions">Terms & conditions</a><a href="https://affiliate.skinfox.in/">Become an affiliate</a></div>
        </div>
        <div className="shell site-footer__bottom"><p>© {new Date().getFullYear()} SkinFox. All rights reserved.</p><p>Thoughtful care, from root to skin.</p><a href="#top">Back to top ↑</a></div>
        <img className="site-footer__wordmark" src="/brand/skinfox-logo.png" alt="" aria-hidden="true" />
      </footer>

      <QuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(product, quantity) => addToCart(product, quantity, true)} />
      <CartDrawer open={cartOpen} lines={cart} onClose={() => setCartOpen(false)} onQuantity={updateQuantity} onRemove={(id) => updateQuantity(id, 0)} waitlistDepositPaise={storefront.waitlist.depositPaise} waitlistDiscountPercent={storefront.waitlist.discountPercent} onCheckout={() => { setCartOpen(false); if (cart.some((line) => line.product.price === null) || storefront.waitlist.enabled) setWaitlistOpen(true); else setCheckoutOpen(true) }} />
      <RoutineQuiz open={quizOpen} onClose={() => setQuizOpen(false)} onAdd={(product) => addToCart(product)} catalogue={collectionProducts} finder={storefront.careFinder ?? undefined} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onView={setSelectedProduct} catalogue={collectionProducts} apiMode={storefront.apiMode} />
      <CheckoutModal open={checkoutOpen} lines={cart} cartToken={cartToken} apiAvailable={storefront.apiMode} onCustomerChange={setCustomer} onClose={() => setCheckoutOpen(false)} onComplete={() => { setCart([]); if (cartToken) localStorage.removeItem('skinfox-cart-token'); setCartToken('') }} />
      <WaitlistModal open={waitlistOpen} lines={cart} config={storefront.waitlist} apiAvailable={storefront.apiMode} onCustomerChange={setCustomer} onClose={() => setWaitlistOpen(false)} onComplete={() => { setCart([]); if (cartToken) localStorage.removeItem('skinfox-cart-token'); setCartToken('') }} />
      <CustomerAccount open={accountOpen} onClose={() => setAccountOpen(false)} apiAvailable={storefront.apiMode} onCustomerChange={setCustomer} initialSection={accountSection} />

      <AnimatePresence>
        {toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><Check size={16} /> {toast}</motion.div>}
      </AnimatePresence>
    </div>
  )
}
