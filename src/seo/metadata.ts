import type { Product } from '../types'

export const SITE_URL = 'https://skinfox.in'
export const HOME_TITLE = 'SkinFox | Skin, Body, Hair & Scalp Care'
export const HOME_DESCRIPTION = 'Discover SkinFox skin, body, hair and scalp care. Explore product details, find a routine for your needs and manage your orders online.'
export type FaqEntry = { question: string; answer: string }
export type SeoPage = { title: string; description: string; path: string; image?: string; imageAlt?: string; noindex?: boolean; structuredData?: Record<string, unknown>[] }

export const productPath = (product: Pick<Product, 'id'>) => `/products/${encodeURIComponent(product.id)}`
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href

export const organizationSchema = {
  '@type': 'OnlineStore', '@id': `${SITE_URL}/#organization`, name: 'SkinFox', url: `${SITE_URL}/`,
  logo: `${SITE_URL}/brand/skinfox-logo.png`, email: 'contact@skinfox.in',
  description: 'Skin, body, hair and scalp-care products.',
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })) }
}

export function homeSeo(faqs: FaqEntry[] = []): SeoPage {
  const structuredData: Record<string, unknown>[] = [organizationSchema, {
    '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: 'SkinFox',
    inLanguage: 'en-IN', publisher: { '@id': `${SITE_URL}/#organization` },
  }]
  if (faqs.length) structuredData.push({
    '@type': 'FAQPage', '@id': `${SITE_URL}/#faq`,
    mainEntity: faqs.filter((item) => item.question.trim() && item.answer.trim()).map((item) => ({
      '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  })
  return { title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/', structuredData }
}

export function productSeo(product: Product): SeoPage {
  const path = productPath(product)
  const productSchema: Record<string, unknown> = {
    '@type': 'Product', '@id': `${absoluteUrl(path)}#product`, name: product.name,
    description: `${product.subtitle}. ${product.benefit}`, image: [absoluteUrl(product.image)],
    sku: product.id, brand: { '@type': 'Brand', name: 'SkinFox' }, category: product.category, size: product.size,
    url: absoluteUrl(path),
  }
  // MRP is not the selling price. Never publish an offer for a price-pending item.
  if (typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0) {
    const purchaseState = (product as Product & { purchaseState?: string }).purchaseState
    productSchema.offers = {
      '@type': 'Offer', url: absoluteUrl(path), priceCurrency: 'INR', price: product.price.toFixed(2),
      seller: { '@id': `${SITE_URL}/#organization` },
      ...(purchaseState === 'out_of_stock' ? { availability: 'https://schema.org/OutOfStock' } : {}),
    }
  }
  return {
    title: `${product.name} ${product.size} | ${product.category} Care | SkinFox`,
    description: `${product.subtitle}. ${product.benefit} Explore ${product.size} pack details and current pricing at SkinFox.`,
    path, image: product.image, imageAlt: product.imageAlt,
    structuredData: [organizationSchema, productSchema, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: product.name, path }])],
  }
}

export function legalSeo(kind: 'privacy' | 'terms'): SeoPage {
  const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'
  const path = kind === 'privacy' ? '/privacy-policy' : '/terms-and-conditions'
  return {
    title: `${title} | SkinFox`, path,
    description: kind === 'privacy' ? 'Read how SkinFox uses and protects your personal information, including customer accounts, orders, cookies and privacy requests.' : 'Read the SkinFox terms for shopping, customer accounts, product information, orders, delivery and customer support.',
    structuredData: [organizationSchema, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: title, path }])],
  }
}

export const serializeSchema = (data: Record<string, unknown>[] = []) => JSON.stringify({ '@context': 'https://schema.org', '@graph': data }).replace(/</g, '\\u003c')

export function pageMetaEntries(page: SeoPage) {
  const image = absoluteUrl(page.image ?? '/brand/skinfox-logo.png')
  return [
    ['name', 'description', page.description],
    ['name', 'robots', page.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'],
    ['property', 'og:type', 'website'], ['property', 'og:site_name', 'SkinFox'], ['property', 'og:locale', 'en_IN'],
    ['property', 'og:title', page.title], ['property', 'og:description', page.description],
    ['property', 'og:url', absoluteUrl(page.path)], ['property', 'og:image', image],
    ['property', 'og:image:alt', page.imageAlt ?? 'SkinFox — skin, body, hair and scalp care'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', page.title],
    ['name', 'twitter:description', page.description], ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', page.imageAlt ?? 'SkinFox — skin, body, hair and scalp care'],
  ] as const
}
