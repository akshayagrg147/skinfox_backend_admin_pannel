import { ArrowRight, ChevronRight, Leaf } from 'lucide-react'
import type { Product } from '../types'
import { ProductCard } from '../components/ProductCard'
import { SiteSeo } from './SiteSeo'
import { categoryPages, type CategorySlug } from './content'
import { categorySeo } from './metadata'

type CategoryPageProps = { slug: CategorySlug; products: Product[]; loading?: boolean; onAdd: (product: Product) => void }

export function CategoryPage({ slug, products, loading = false, onAdd }: CategoryPageProps) {
  const page = categoryPages[slug]
  const categoryProducts = products.filter((product) => product.concerns.some((concern) => page.concerns.includes(concern)))
  return <section className="seo-landing seo-category shell">
    <SiteSeo page={categorySeo(slug)} />
    <nav className="seo-landing__breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{page.name}</span></nav>
    <header className="seo-landing__hero">
      <span className="eyebrow"><Leaf size={15} /> SkinFox care range</span>
      <h1>{page.name} products for everyday routines</h1>
      <p>{page.intro}</p>
      <div className="seo-landing__actions"><a className="button button--dark" href="/#shop">Shop the full collection <ArrowRight size={17} /></a><a className="text-link" href="/guides">Read care guides <ArrowRight size={16} /></a></div>
    </header>
    <section className="seo-category__products" aria-labelledby="category-products-title">
      <div className="seo-landing__section-heading"><div><span className="section-number">Explore the edit</span><h2 id="category-products-title">{page.name} essentials</h2></div><span>{loading ? 'Loading' : `${categoryProducts.length} ${categoryProducts.length === 1 ? 'product' : 'products'}`}</span></div>
      {loading ? <p className="seo-landing__empty" role="status">Loading the current {page.name.toLowerCase()} collection…</p> : categoryProducts.length ? <div className="product-grid" role="list">{categoryProducts.map((product, index) => <div role="listitem" key={product.id}><ProductCard product={product} index={index} onAdd={onAdd} /></div>)}</div> : <p className="seo-landing__empty">Product details are being refreshed. Please explore the full collection or check back shortly.</p>}
    </section>
    <section className="seo-landing__copy seo-category__copy">
      <div><span className="section-number">A clear place to start</span><h2>Choose care that fits your day.</h2></div>
      <div><p>SkinFox keeps skin, hair and body-care information easy to compare: pack size, current price, product format and label-led directions. We avoid unsupported medical promises, and we recommend reading the final product label before use.</p><p>For persistent, painful or concerning symptoms, speak with a qualified healthcare professional. Find My Care can help you explore cosmetic routine options, but it is not a diagnosis.</p></div>
    </section>
  </section>
}
