import { ArrowRight, ChevronRight, Leaf } from 'lucide-react'
import type { Product } from '../types'
import { ProductCard } from '../components/ProductCard'
import { SiteSeo } from './SiteSeo'
import { shopSeo } from './metadata'

type ShopPageProps = { products: Product[]; loading?: boolean; onAdd: (product: Product) => void }

/** A real crawlable catalogue URL. The homepage can remain editorial while
 * search engines and customers have one stable destination for every product. */
export function ShopPage({ products, loading = false, onAdd }: ShopPageProps) {
  return <section className="seo-landing seo-shop shell">
    <SiteSeo page={shopSeo()} />
    <nav className="seo-landing__breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">Shop</span></nav>
    <header className="seo-landing__hero">
      <span className="eyebrow"><Leaf size={15} /> SkinFox / shop</span>
      <h1>Skin care, hair care and body care for everyday routines.</h1>
      <p>Compare SkinFox formats, pack sizes, current pricing and label-led product information in one clear collection.</p>
      <div className="seo-landing__actions"><a className="text-link" href="/guides">Read care guides <ArrowRight size={16} /></a></div>
    </header>
    <section className="seo-category__products" aria-labelledby="shop-products-title">
      <div className="seo-landing__section-heading"><div><span className="section-number">The current edit</span><h2 id="shop-products-title">Explore all products</h2></div><span>{loading ? 'Loading' : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}</span></div>
      {loading ? <p className="seo-landing__empty" role="status">Loading the current SkinFox collection…</p> : products.length ? <div className="product-grid" role="list">{products.map((product, index) => <div role="listitem" key={product.id}><ProductCard product={product} index={index} onAdd={onAdd} /></div>)}</div> : <p className="seo-landing__empty">Product details are being refreshed. Please check back shortly.</p>}
    </section>
  </section>
}
