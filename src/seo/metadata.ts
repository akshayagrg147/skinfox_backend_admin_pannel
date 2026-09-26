import type { Product } from '../types'
import { aboutPage, categoryPages, defaultFaqs, productSeoContent, type CategorySlug } from './content'

export const SITE_URL = 'https://skinfox.in'
export const HOME_TITLE = 'SkinFox – Skin Care & Hair Care Products Online in India'
export const HOME_DESCRIPTION = 'Shop SkinFox SPF 50 sunscreen, acne-prone face wash, dry-skin lotions, onion hair oil & onion shampoo. Launching soon – enjoy 40% off on the first 500 orders.'
export type FaqEntry = { question: string; answer: string }
export type SeoPage = { title: string; description: string; path: string; image?: string; imageAlt?: string; ogType?: 'website' | 'product'; noindex?: boolean; structuredData?: Record<string, unknown>[] }

export const productPath = (product: Pick<Product, 'id'>) => `/products/${encodeURIComponent(product.id)}`
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href

export const organizationSchema = {
  '@type': ['Organization', 'OnlineStore'], '@id': `${SITE_URL}/#organization`, name: 'SkinFox', legalName: 'VEDICSOLVE PRIVATE LIMITED', url: `${SITE_URL}/`,
  logo: `${SITE_URL}/brand/skinfox-logo.png`, email: 'contact@skinfox.in', telephone: '+91 70820 48820',
  description: 'Skin, body, hair and scalp-care products.',
  sameAs: ['https://www.instagram.com/skinfox_official/', 'https://www.facebook.com/profile.php?id=61593882756421'],
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', telephone: '+91 70820 48820', email: 'contact@skinfox.in', availableLanguage: ['English', 'Hindi'] }],
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
  return { title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/', image: '/products/rayyvia-sun-protect-primary.webp', imageAlt: 'SkinFox SPF 50 sunscreen for face in a yellow and pink tube', structuredData }
}

export function productSeo(product: Product): SeoPage {
  const path = productPath(product)
  const content = productSeoContent[product.id]
  const productSchema: Record<string, unknown> = {
    '@type': 'Product', '@id': `${absoluteUrl(path)}#product`, name: product.name,
    description: content?.intro ?? `${product.subtitle}. ${product.benefit}`, image: [absoluteUrl(product.image), ...product.media.filter((item) => item.type === 'image' && item.src !== product.image).map((item) => absoluteUrl(item.src))],
    sku: product.id, brand: { '@type': 'Brand', name: 'SkinFox' }, category: product.category, size: product.size,
    url: absoluteUrl(path),
  }
  // MRP is not the selling price. Never publish an offer for a price-pending item.
  if (typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0) {
    const purchaseState = (product as Product & { purchaseState?: string }).purchaseState
    const availability = purchaseState === 'out_of_stock'
      ? 'https://schema.org/OutOfStock'
      : purchaseState === 'preorder' || purchaseState === 'coming_soon'
        ? 'https://schema.org/PreOrder'
        : 'https://schema.org/InStock'
    productSchema.offers = {
      '@type': 'Offer', url: absoluteUrl(path), priceCurrency: 'INR', price: product.price.toFixed(2),
      seller: { '@id': `${SITE_URL}/#organization` },
      availability,
    }
  }
  const structuredData: Record<string, unknown>[] = [organizationSchema, productSchema, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: content?.searchPhrase ?? product.category, path: categoryPathForProduct(product) }, { name: product.name, path }])]
  if (content?.faqs.length) structuredData.push({ '@type': 'FAQPage', '@id': `${absoluteUrl(path)}#faq`, mainEntity: content.faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) })
  return {
    title: content?.title ?? `${product.name} ${product.size} | ${product.category} Care | SkinFox`,
    description: content?.description ?? `${product.subtitle}. ${product.benefit} Explore ${product.size} pack details and current pricing at SkinFox.`,
    path, image: product.image, imageAlt: product.imageAlt, ogType: 'product',
    structuredData,
  }
}

export const categoryPathForProduct = (product: Pick<Product, 'category' | 'concerns'>) => product.concerns.some((item) => ['Hair', 'Hair Wash', 'Hair Oil', 'Scalp Care'].includes(item)) ? '/hair-care' : product.concerns.some((item) => ['Dry Skin', 'Gentle Moisture'].includes(item)) && !product.concerns.some((item) => ['Sun Protection', 'Face Wash', 'Acne & Oily Skin'].includes(item)) ? '/body-care' : '/skin-care'

export function categorySeo(slug: CategorySlug): SeoPage {
  const page = categoryPages[slug]
  return {
    title: page.title, description: page.description, path: `/${slug}`, image: slug === 'hair-care' ? '/products/onion-hair-oil-primary.webp' : slug === 'body-care' ? '/products/hydrelle-campaign-new.webp' : '/products/rayyvia-sun-protect-primary.webp',
    structuredData: [organizationSchema, { '@type': 'CollectionPage', '@id': `${SITE_URL}/${slug}#collection`, name: page.name, description: page.description, url: absoluteUrl(`/${slug}`) }, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: page.name, path: `/${slug}` }])],
  }
}

export function aboutSeo(): SeoPage {
  return { title: `${aboutPage.title}`, description: aboutPage.description, path: '/about', image: '/products/hydrelle-campaign-new.webp', imageAlt: 'SkinFox Hydrelle moisturising lotion campaign', structuredData: [organizationSchema, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'About SkinFox', path: '/about' }])] }
}

export function faqSeo(faqs: FaqEntry[] = defaultFaqs): SeoPage {
  return { title: 'SkinFox FAQs | Product, Orders & Care Support', description: 'Read SkinFox answers about product use, prices, orders, delivery, accounts and cosmetic care guidance.', path: '/faq', image: '/products/rayyvia-sun-protect-primary.webp', imageAlt: 'SkinFox Rayyvia Sun Protect facial sunscreen', structuredData: [organizationSchema, { '@type': 'FAQPage', '@id': `${SITE_URL}/faq#faq`, mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'FAQs', path: '/faq' }])] }
}

export function shopSeo(): SeoPage {
  return { title: 'Shop Skin Care & Hair Care Products | SkinFox', description: 'Shop SkinFox skin care, hair care and body care products online in India. Compare pack sizes, product details, current prices and label-led usage.', path: '/shop', image: '/products/rayyvia-sun-protect-primary.webp', imageAlt: 'SkinFox skin care and hair care product collection', structuredData: [organizationSchema, { '@type': 'CollectionPage', '@id': `${SITE_URL}/shop#collection`, name: 'Shop SkinFox products', description: 'Skin, hair and body care products from SkinFox.', url: absoluteUrl('/shop') }, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }])] }
}

export function contactSeo(): SeoPage {
  return { title: 'Contact SkinFox | Customer Support', description: 'Contact SkinFox customer support by email or phone for product, order and delivery help.', path: '/contact', image: '/products/rayyvia-sun-protect-primary.webp', imageAlt: 'SkinFox Rayyvia Sun Protect facial sunscreen', structuredData: [organizationSchema, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])] }
}

export function shippingReturnsSeo(): SeoPage {
  return { title: 'Shipping & Returns | SkinFox', description: 'Read SkinFox delivery timelines, shipping charges, serviceability, payment and returns information before ordering.', path: '/shipping-returns', image: '/products/coco-kiss-lotion-primary.webp', imageAlt: 'SkinFox Coco Kiss moisturising lotion', structuredData: [organizationSchema, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shipping & returns', path: '/shipping-returns' }])] }
}

export function guideSeo(slug: string, guide: { title: string; excerpt: string }): SeoPage {
  const path = `/guides/${slug}`
  return { title: `${guide.title} | SkinFox`, description: guide.excerpt, path, image: '/products/rayyvia-sun-protect-primary.webp', imageAlt: 'SkinFox everyday care guide', structuredData: [organizationSchema, { '@type': 'Article', '@id': `${absoluteUrl(path)}#article`, headline: guide.title, description: guide.excerpt, author: { '@id': `${SITE_URL}/#organization` }, publisher: { '@id': `${SITE_URL}/#organization` }, mainEntityOfPage: absoluteUrl(path) }, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Care guides', path: '/guides' }, { name: guide.title, path }])] }
}

export function guidesSeo(): SeoPage {
  return { title: 'SkinFox Guides | Skincare, Hair Care & Body Care', description: 'Read practical SkinFox guides about SPF 50 sunscreen, onion hair oil, shampoo and moisturiser routines in India.', path: '/guides', image: '/products/rayyvia-sun-protect-primary.webp', structuredData: [organizationSchema, { '@type': 'CollectionPage', '@id': `${SITE_URL}/guides#collection`, name: 'SkinFox care guides', description: 'Practical, label-led cosmetic care guides.', url: absoluteUrl('/guides') }, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }])] } }

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
    ['property', 'og:type', page.ogType ?? 'website'], ['property', 'og:site_name', 'SkinFox'], ['property', 'og:locale', 'en_IN'],
    ['property', 'og:title', page.title], ['property', 'og:description', page.description],
    ['property', 'og:url', absoluteUrl(page.path)], ['property', 'og:image', image],
    ['property', 'og:image:alt', page.imageAlt ?? 'SkinFox — skin, body, hair and scalp care'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', page.title],
    ['name', 'twitter:description', page.description], ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', page.imageAlt ?? 'SkinFox — skin, body, hair and scalp care'],
  ] as const
}
