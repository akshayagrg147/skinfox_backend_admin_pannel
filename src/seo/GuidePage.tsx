import { ArrowRight, ChevronRight } from 'lucide-react'
import { SiteSeo } from './SiteSeo'
import { guidePages } from './content'
import { guideSeo } from './metadata'

export function GuidePage({ slug }: { slug: string }) {
  const guide = guidePages.find((item) => item.slug === slug)
  if (!guide) return <main className="product-page shell product-page--message"><SiteSeo page={{ title: 'Guide not found | SkinFox', description: 'Explore SkinFox care guides.', path: `/guides/${slug}`, noindex: true }} /><h1>This guide has moved.</h1><p>Explore the SkinFox care guides for practical routine information.</p><a className="button button--dark" href="/guides">View care guides <ArrowRight size={17} /></a></main>
  return <article className="seo-landing seo-guide shell">
    <SiteSeo page={guideSeo(guide.slug, guide)} />
    <nav className="seo-landing__breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><ChevronRight size={14} aria-hidden="true" /><a href="/guides">Care guides</a><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{guide.title}</span></nav>
    <header className="seo-landing__hero"><span className="eyebrow">SkinFox / care guide</span><h1>{guide.title}</h1><p>{guide.excerpt}</p></header>
    <div className="seo-guide__body">{guide.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}</div>
    <section className="seo-landing__callout"><strong>Ready to explore the collection?</strong><a href="/shop">Shop SkinFox products <ArrowRight size={16} /></a></section>
  </article>
}
