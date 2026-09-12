import { ArrowRight, Check, ChevronRight, Crown, KeyRound, Mail, Minus, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { WaitlistConfig } from '../hooks/useStorefront'
import type { Product } from '../types'
import { products as catalog } from '../data/products'
import { SiteSeo } from './SiteSeo'
import { productPath, productSeo } from './metadata'
import { productImageSrcSet } from '../utils/productImages'
import './seo.css'

type ProductPageProps = {
  product?: Product
  productSlug: string
  loading?: boolean
  error?: string
  catalogProducts?: Product[]
  waitlist?: WaitlistConfig
  founderNumber?: number | null
  onAdd: (product: Product, quantity: number) => void
  onFindCare: () => void
}

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function ProductPage({ product, productSlug, loading = false, error = '', catalogProducts = catalog, waitlist, founderNumber, onAdd, onFindCare }: ProductPageProps) {
  const checkingPrice = loading || Boolean(import.meta.env.SSR && import.meta.env.MODE !== 'test')
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const displayProduct = product ?? (loading || error ? catalog.find((item) => item.id === productSlug) : undefined)
  if (!displayProduct) return <section className="product-page shell product-page--message">
    <SiteSeo page={{ title: loading ? 'Loading product | SkinFox' : 'Product not found | SkinFox', description: 'Explore the current SkinFox skin, body, hair and scalp-care collection.', path: `/products/${encodeURIComponent(productSlug)}`, noindex: !loading }} />
    <span className="eyebrow">SkinFox collection</span><h1>{loading ? 'Finding your care…' : 'We couldn’t find this product.'}</h1>
    <p>{loading ? 'Please wait while we load the current product details.' : 'Explore the collection to find your next daily-care essential.'}</p>
    <a href="/#shop" className="button button--dark">Explore the collection <ArrowRight size={17} /></a>
  </section>
  const images = displayProduct.media.filter((item) => item.type === 'image')
  const selectedImage = images[activeImage] ?? { src: displayProduct.image, alt: displayProduct.imageAlt }
  const related = catalogProducts.filter((item) => item.id !== displayProduct.id && item.concerns.some((concern) => displayProduct.concerns.includes(concern))).slice(0, 3)
  const launch = waitlist ?? { enabled: displayProduct.price === null, stage: displayProduct.price === null ? 'waitlist' : 'regular', founderCapacity: 200, founderClaimed: 0, founderRemaining: 200, foundingClosed: false, founderPricePaise: 59900, launchPricePaise: 64900, regularPricePaise: (displayProduct.mrp ?? 700) * 100 } as WaitlistConfig
  const founderEligible = Boolean(founderNumber && founderNumber <= launch.founderCapacity)
  const foundingOpen = launch.enabled && launch.stage === 'waitlist' && !launch.foundingClosed
  // The founding benefit is consumed by the converted waitlist order. Once the
  // public launch opens, product pages must show the same price to every
  // shopper instead of re-presenting the former member offer.
  const founderReveal = founderEligible && launch.stage === 'founder_reveal'
  const founderAccessLocked = launch.stage === 'founder_reveal' && !founderEligible
  const shownPrice = founderReveal ? launch.founderPricePaise ?? 59900 : launch.stage === 'launch' ? launch.launchPricePaise : launch.stage === 'regular' ? launch.regularPricePaise : null
  const primaryLabel = foundingOpen ? 'Join Waitlist @ ₹99/-' : founderReveal ? 'Claim My Launch Price' : founderAccessLocked ? 'Member Access Reserved' : 'Add to bag'
  const mrpPaise = (displayProduct.mrp ?? launch.regularPricePaise / 100) * 100
  return <section className="product-page shell">
    <SiteSeo page={productSeo(displayProduct)} />
    <nav className="product-page__breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-hidden="true"><ChevronRight size={13} /></li><li><a href="/#shop">Shop</a></li><li aria-hidden="true"><ChevronRight size={13} /></li><li aria-current="page">{displayProduct.name}</li></ol></nav>
    <div className="product-page__grid">
      <div className="product-page__gallery">
        <div className="product-page__image"><img src={selectedImage.src} srcSet={productImageSrcSet(selectedImage.src)} sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1100px) 45vw, 580px" alt={selectedImage.alt || displayProduct.imageAlt} width="800" height="800" {...{ fetchpriority: 'high' }} decoding="async" /></div>
        {images.length > 1 && <div className="product-page__thumbnails" role="group" aria-label={`${displayProduct.name} photographs`}>{images.map((item, index) => <button key={item.src} type="button" onClick={() => setActiveImage(index)} aria-pressed={index === activeImage} aria-label={`View photograph ${index + 1}: ${item.alt}`}><img src={item.src} alt="" width="80" height="80" loading="lazy" decoding="async" /></button>)}</div>}
      </div>
      <div className="product-page__information">
        <span className="eyebrow">{displayProduct.category} care · {displayProduct.step}</span>
        <h1>{displayProduct.name}</h1><p className="product-page__subtitle">{displayProduct.subtitle}</p>
        <div className="product-page__attributes"><span>{displayProduct.size}</span><span>{displayProduct.concern}</span></div>
        <p className="product-page__benefit">{displayProduct.benefit}</p>
        <div className="product-page__pricing">{checkingPrice ? <p role="status">Checking current launch access…</p> : error ? <p role="alert">We couldn’t load current availability. Please <a href={productPath(displayProduct)}>try again</a>.</p> : foundingOpen ? <div className="founder-offer">
          <span className="founder-offer__mrp">MRP {money(mrpPaise)}</span>
          <span className="founder-offer__eyebrow"><Crown size={15} /> Only for the First {launch.founderCapacity} Members</span>
          <strong>Exclusive Launch Price <em>— Revealing Soon</em></strong>
          <p>Join the waitlist and unlock an exclusive launch price before everyone else.</p>
          <div className="founder-progress" aria-label={`${launch.founderClaimed} of ${launch.founderCapacity} founder spots claimed`}><span><b>{launch.founderClaimed} / {launch.founderCapacity}</b> Founder Spots Claimed</span><i><span style={{ width: `${Math.min(100, launch.founderClaimed / launch.founderCapacity * 100)}%` }} /></i><small>{launch.founderRemaining} founder {launch.founderRemaining === 1 ? 'place' : 'places'} remaining</small></div>
        </div> : <div className="founder-offer founder-offer--revealed">
          <span className="founder-offer__mrp">MRP {money(mrpPaise)}</span>
          {founderReveal ? <><span className="founder-offer__eyebrow"><Crown size={15} /> Exclusive to the First {launch.founderCapacity} Members</span><strong><em>Member Launch Price</em> {money(shownPrice!)}</strong><p>Early-member benefit: Save {money(mrpPaise - shownPrice!)}. Your launch price is reserved for a limited time.</p></> : founderAccessLocked ? <><span className="founder-offer__eyebrow"><Crown size={15} /> Member reveal in progress</span><strong><em>Launch Price</em> Reserved for Members</strong><p>Sign in with the account used to join the Founding {launch.founderCapacity}. Public Launch Price {money(launch.launchPricePaise)} follows next.</p></> : <><span className="founder-offer__eyebrow"><Sparkles size={15} /> {launch.stage === 'regular' ? 'SkinFox collection' : 'Now available to everyone'}</span><strong><em>{launch.stage === 'regular' ? 'Regular Price' : 'Launch Price'}</em> {money(shownPrice ?? launch.regularPricePaise)}</strong><p>{launch.stage === 'regular' ? 'The SkinFox collection is now available to everyone.' : 'The public launch price is now available to everyone.'}</p></>}
        </div>}</div>
        <div className="product-page__purchase">
          <div className="quantity-control" role="group" aria-label="Product quantity"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity" disabled={quantity === 1}><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button type="button" onClick={() => setQuantity((value) => Math.min(8, value + 1))} aria-label="Increase quantity" disabled={quantity === 8}><Plus size={16} /></button></div>
          <button className="button button--dark" type="button" disabled={checkingPrice || Boolean(error) || !product || founderAccessLocked} onClick={() => product && onAdd(product, quantity)}>{primaryLabel} <ArrowRight size={18} /></button>
        </div>
        {foundingOpen && <>
          <div className="founder-trust" aria-label="Founding 200 membership benefits"><span><KeyRound size={15} /> Limited to first {launch.founderCapacity} customers</span><span><Crown size={15} /> Exclusive launch pricing</span><span><Sparkles size={15} /> Early access before public launch</span><span><Check size={15} /> Premium SkinFox experience</span></div>
          <div className="founder-journey" aria-label="SkinFox launch pricing journey"><span className={launch.stage === 'waitlist' ? 'is-current' : ''}><small>Waitlist</small><strong>Price reserved</strong></span><i /><span className={launch.stage === 'founder_reveal' ? 'is-current' : ''}><small>Founding {launch.founderCapacity}</small><strong>Reveals soon</strong></span><i /><span><small>Launch</small><strong>{money(launch.launchPricePaise)}</strong></span><i /><span><small>Regular</small><strong>{money(launch.regularPricePaise)}</strong></span></div>
        </>}
        <button className="product-page__finder" type="button" onClick={onFindCare}><Sparkles size={18} /><span>Not sure where to start?<strong>Find your care routine</strong></span><ArrowRight size={18} /></button>
        <a className="product-page__support" href="mailto:contact@skinfox.in"><Mail size={15} /> Ask us about this product</a>
      </div>
    </div>
    <div className="product-page__details">
      <section><span className="eyebrow">Get to know your care</span><h2>About {displayProduct.name}</h2><p>{displayProduct.description}</p></section>
      <section><span className="eyebrow">At a glance</span><h2>Product details</h2><ul>{displayProduct.highlights.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul><p className="product-page__note">Follow the directions on your product label. Find My Care offers cosmetic routine guidance, not a medical diagnosis. For persistent or concerning symptoms, speak with a qualified healthcare professional.</p></section>
    </div>
    {related.length > 0 && <section className="product-page__related"><div className="product-page__section-heading"><div><span className="eyebrow">Explore the collection</span><h2>More for your everyday care</h2></div><a href="/#shop">Shop all <ArrowRight size={16} /></a></div><div className="product-page__related-grid">{related.map((item) => <a href={productPath(item)} key={item.id}><img src={item.image} alt={item.imageAlt} width="400" height="400" loading="lazy" decoding="async" /><span>{item.category} · {item.size}</span><h3>{item.name}</h3><p>{item.subtitle}</p><ArrowRight size={17} /></a>)}</div></section>}
  </section>
}
