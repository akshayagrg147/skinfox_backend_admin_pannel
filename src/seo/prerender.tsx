/* This module is only executed by the production prerender build. */
import { renderToStaticMarkup } from 'react-dom/server'
import { MotionConfig } from 'framer-motion'
import App from '../App'
import { LegalPage } from '../components/LegalPage'
import { products } from '../data/products'
import { defaultFaqs } from './content'
import { homeSeo, legalSeo, productSeo, type SeoPage } from './metadata'

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
  return pages
}
