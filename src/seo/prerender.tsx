/* This module is only executed by the production prerender build. */
import { renderToStaticMarkup } from 'react-dom/server'
import { MotionConfig } from 'framer-motion'
import App from '../App'
import { LegalPage } from '../components/LegalPage'
import { products } from '../data/products'
import { defaultFaqs, guidePages } from './content'
import { categoryPages, type CategorySlug } from './content'
import { homeSeo, legalSeo, productSeo, categorySeo, aboutSeo, faqSeo, guidesSeo, shopSeo, contactSeo, shippingReturnsSeo, guideSeo, type SeoPage } from './metadata'
import { GuidePage } from './GuidePage'

export function renderSeoPages(): Array<{ path: string; metadata: SeoPage; html: string }> {
  const pages = [{ path: '/', metadata: homeSeo(defaultFaqs), html: renderToStaticMarkup(<MotionConfig reducedMotion="user"><App /></MotionConfig>) }]
  for (const kind of ['privacy', 'terms'] as const) {
    const metadata = legalSeo(kind)
    pages.push({ path: metadata.path, metadata, html: renderToStaticMarkup(<LegalPage kind={kind} onBack={() => undefined} />) })
  }
  for (const product of products) {
    const metadata = productSeo(product)
    pages.push({ path: metadata.path, metadata, html: renderToStaticMarkup(<MotionConfig reducedMotion="user"><App productSlug={product.id} /></MotionConfig>) })
  }
  for (const slug of Object.keys(categoryPages) as CategorySlug[]) {
    const metadata = categorySeo(slug)
    pages.push({ path: metadata.path, metadata, html: renderToStaticMarkup(<MotionConfig reducedMotion="user"><App pageSlug={slug} /></MotionConfig>) })
  }
  const shopMetadata = shopSeo()
  pages.push({ path: shopMetadata.path, metadata: shopMetadata, html: renderToStaticMarkup(<MotionConfig reducedMotion="user"><App pageSlug="shop" /></MotionConfig>) })
  const editorialPages: Array<['about' | 'faq' | 'guides' | 'contact' | 'shipping-returns', SeoPage]> = [['about', aboutSeo()], ['faq', faqSeo()], ['guides', guidesSeo()], ['contact', contactSeo()], ['shipping-returns', shippingReturnsSeo()]]
  for (const [pageSlug, metadata] of editorialPages) {
    pages.push({ path: metadata.path, metadata, html: renderToStaticMarkup(<MotionConfig reducedMotion="user"><App pageSlug={pageSlug} /></MotionConfig>) })
  }
  for (const guide of guidePages) {
    const metadata = guideSeo(guide.slug, guide)
    pages.push({ path: metadata.path, metadata, html: renderToStaticMarkup(<MotionConfig reducedMotion="user"><GuidePage slug={guide.slug} /></MotionConfig>) })
  }
  return pages
}
