import { useEffect } from 'react'
import { absoluteUrl, homeSeo, pageMetaEntries, serializeSchema, type FaqEntry, type SeoPage } from './metadata'

export function SiteSeo({ page, faqs = [] }: { page?: SeoPage; faqs?: FaqEntry[] }) {
  const resolvedPage = page ?? homeSeo(faqs)
  const serializedPage = JSON.stringify(resolvedPage)
  useEffect(() => {
    const current = JSON.parse(serializedPage) as SeoPage
    document.title = current.title
    for (const [attribute, key, value] of pageMetaEntries(current)) {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute(attribute, key)
        document.head.appendChild(element)
      }
      element.content = value
    }
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = absoluteUrl(current.path)
    let structuredData = document.getElementById('skinfox-schema') as HTMLScriptElement | null
    if (!structuredData) {
      structuredData = document.createElement('script')
      structuredData.id = 'skinfox-schema'
      structuredData.type = 'application/ld+json'
      document.head.appendChild(structuredData)
    }
    structuredData.textContent = serializeSchema(current.structuredData)
  }, [serializedPage])
  return null
}
