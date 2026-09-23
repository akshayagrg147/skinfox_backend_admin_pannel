import { ArrowRight, Check, ChevronRight, Mail, Minus, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '../types'
import { products as catalog } from '../data/products'
import { SiteSeo } from './SiteSeo'
import { categoryPathForProduct, productPath, productSeo } from './metadata'
import { productSeoContent } from './content'
import { productImageSrcSet } from '../utils/productImages'
import './seo.css'

type ProductPageProps = {
  product?: Product
  productSlug: string
  loading?: boolean
  error?: string
  catalogProducts?: Product[]
  onAdd: (product: Product, quantity: number) => void
  onFindCare: () => void
}

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function ProductPage({ product, productSlug, loading = false, error = '', catalogProducts = catalog, onAdd, onFindCare }: ProductPageProps) {
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const displayProduct = product ?? (loading || error ? catalog.find((item) => item.id === productSlug) : undefined)
  if (!displayProduct) return <section className="product-page shell product-page--message">
    <SiteSeo page={{ title: loading ? 'Loading product | SkinFox' : 'Product not found | SkinFox', description: 'Explore the current SkinFox skin, body, hair and scalp-care collection.', path: `/products/${encodeURIComponent(productSlug)}`, noindex: !loading }} />
    <span className="eyebrow">SkinFox collection</span><h1>{loading ? 'Finding your care…' : 'We couldn’t find this product.'}</h1>
    <p>{loading ? 'Please wait while we load the current product details.' : 'Explore the collection to find your next daily-care essential.'}</p>
    <a href="/shop" className="button button--dark">Explore the collection <ArrowRight size={17} /></a>
  </section>
  const images = displayProduct.media.filter((item) => item.type === 'image')
  const selectedImage = images[activeImage] ?? { src: displayProduct.image, alt: displayProduct.imageAlt }
  const related = catalogProducts.filter((item) => item.id !== displayProduct.id && item.concerns.some((concern) => displayProduct.concerns.includes(concern))).slice(0, 3)
  const seoContent = productSeoContent[displayProduct.id]
  const hasPrice = displayProduct.price !== null
  const primaryLabel = hasPrice ? 'Add to bag' : 'Notify me when available'
  return <section className="product-page shell">
    <SiteSeo page={productSeo(displayProduct)} />
    <nav className="product-page__breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-hidden="true"><ChevronRight size={13} /></li><li><a href={categoryPathForProduct(displayProduct)}>{displayProduct.category} care</a></li><li aria-hidden="true"><ChevronRight size={13} /></li><li aria-current="page">{displayProduct.name}</li></ol></nav>
    <div className="product-page__grid">
      <div className="product-page__gallery">
        <div className="product-page__image"><img src={selectedImage.src} srcSet={productImageSrcSet(selectedImage.src)} sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1100px) 45vw, 580px" alt={selectedImage.alt || displayProduct.imageAlt} width="800" height="800" {...{ fetchpriority: 'high' }} decoding="async" /></div>
        {images.length > 1 && <div className="product-page__thumbnails" role="group" aria-label={`${displayProduct.name} photographs`}>{images.map((item, index) => <button key={item.src} type="button" onClick={() => setActiveImage(index)} aria-pressed={index === activeImage} aria-label={`View photograph ${index + 1}: ${item.alt}`}><img src={item.src} alt={item.alt || `${displayProduct.name} product photograph ${index + 1}`} width="80" height="80" loading="lazy" decoding="async" /></button>)}</div>}
      </div>
      <div className="product-page__information">
        <span className="eyebrow">{displayProduct.category} care · {displayProduct.step}</span>
        <h1>{displayProduct.name}</h1><p className="product-page__subtitle">{seoContent?.searchPhrase ? <><strong>{seoContent.searchPhrase}</strong> · </> : null}{displayProduct.subtitle}</p>
        <div className="product-page__attributes"><span>{displayProduct.size}</span><span>{displayProduct.concern}</span></div>
        <p className="product-page__benefit">{displayProduct.benefit}</p>
        <div className="product-page__pricing">{loading ? <p role="status">Loading product details…</p> : error ? <p role="alert">We couldn’t load current availability. Please <a href={productPath(displayProduct)}>try again</a>.</p> : <div className="product-offer">
          {displayProduct.mrp !== null && <span className="product-offer__mrp">MRP {money(displayProduct.mrp * 100)}</span>}
          {hasPrice ? <><strong>{money(displayProduct.price! * 100)}</strong><span className="product-offer__label">Current selling price</span></> : <><strong>Coming soon</strong><span className="product-offer__label">We’ll notify you when this product is available.</span></>}
        </div>}</div>
        <div className="product-page__purchase">
          <div className="quantity-control" role="group" aria-label="Product quantity"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity" disabled={quantity === 1}><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button type="button" onClick={() => setQuantity((value) => Math.min(8, value + 1))} aria-label="Increase quantity" disabled={quantity === 8}><Plus size={16} /></button></div>
          <button className="button button--dark" type="button" disabled={loading || Boolean(error) || !product || !hasPrice} onClick={() => product && onAdd(product, quantity)}>{primaryLabel} <ArrowRight size={18} /></button>
        </div>
        <div className="product-trust" aria-label="Shopping information"><span><Check size={15} /> Clear product pricing</span><span><Check size={15} /> Secure checkout</span><span><Check size={15} /> Delivery updates</span></div>
        <button className="product-page__finder" type="button" onClick={onFindCare}><Sparkles size={18} /><span>Not sure where to start?<strong>Find your care routine</strong></span><ArrowRight size={18} /></button>
        <a className="product-page__support" href="mailto:contact@skinfox.in"><Mail size={15} /> Ask us about this product</a>
      </div>
    </div>
    <div className="product-page__details">
      <section><span className="eyebrow">Get to know your care</span><h2>About {displayProduct.name}</h2><p>{seoContent?.intro ?? displayProduct.description}</p><p>{displayProduct.description}</p></section>
      <section><span className="eyebrow">A simple routine step</span><h2>How to use</h2><p>{seoContent?.howToUse ?? `Follow the directions on the final ${displayProduct.name} product label.`}</p><p className="product-page__note">Find My Care offers cosmetic routine guidance, not a medical diagnosis. For persistent or concerning symptoms, speak with a qualified healthcare professional.</p></section>
      <section><span className="eyebrow">Suitability</span><h2>Who it is for</h2><p>{seoContent?.suitableFor ?? `Explore this ${displayProduct.category.toLowerCase()} format and review the final pack for approved suitability information.`}</p><ul>{displayProduct.highlights.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul></section>
      <section><span className="eyebrow">Ingredients & transparency</span><h2>What is inside?</h2>{seoContent?.keyIngredients.length ? <ul>{seoContent.keyIngredients.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul> : <p>The key ingredients will be listed here from the approved production label.</p>}<p className="product-page__note">{seoContent?.ingredientNote ?? 'Read the final product label for the complete INCI list, directions and warnings.'}</p></section>
    </div>
    {seoContent?.faqs.length ? <section className="product-page__faqs" id="faq" aria-labelledby="product-faq-title"><span className="eyebrow">Product questions</span><h2 id="product-faq-title">FAQs about {displayProduct.name}</h2><div>{seoContent.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section> : null}
    {related.length > 0 && <section className="product-page__related"><div className="product-page__section-heading"><div><span className="eyebrow">Explore the collection</span><h2>More for your everyday care</h2></div><a href="/shop">Shop all <ArrowRight size={16} /></a></div><div className="product-page__related-grid">{related.map((item) => { const secondaryImage = item.media.filter((media) => media.type === 'image')[1]; return <a href={productPath(item)} key={item.id}><span className={`product-page__related-image${secondaryImage ? ' product-page__related-image--hover-preview' : ''}`}><img className="product-page__related-image-primary" src={item.image} alt={item.imageAlt} width="400" height="400" loading="lazy" decoding="async" />{secondaryImage && <img className="product-page__related-image-secondary" src={secondaryImage.src} alt="" aria-hidden="true" width="400" height="400" loading="lazy" decoding="async" />}</span><span>{item.category} · {item.size}</span><h3>{item.name}</h3><p>{item.subtitle}</p><ArrowRight size={17} /></a>})}</div></section>}
  </section>
}
