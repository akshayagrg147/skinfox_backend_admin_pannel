import { ArrowRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { products } from '../data/products'
import type { Product } from '../types'
import { ModalShell } from './ModalShell'
import { ProductVisual } from './ProductVisual'
import { getStorefront } from '../lib/storefrontApi'

export function SearchOverlay({ open, onClose, onView, catalogue = products, apiMode = false }: { open: boolean; onClose: () => void; onView: (product: Product) => void; catalogue?: Product[]; apiMode?: boolean }) {
  const [query, setQuery] = useState('')
  const [remoteSlugs, setRemoteSlugs] = useState<string[] | null>(null)
  useEffect(() => {
    if (!apiMode || !query.trim()) { setRemoteSlugs(null); return }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void getStorefront<Array<{ slug: string }>>(`/search/suggestions?q=${encodeURIComponent(query.trim())}`).then((response) => { if (!cancelled) setRemoteSlugs(response.map((item) => item.slug)) }).catch(() => { if (!cancelled) setRemoteSlugs([]) })
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [apiMode, query])
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return catalogue.slice(0, 3)
    if (apiMode && remoteSlugs) return remoteSlugs.flatMap((slug) => catalogue.filter((product) => product.id === slug))
    return catalogue.filter((product) => `${product.name} ${product.subtitle} ${product.category} ${product.concerns.join(' ')} ${product.highlights.join(' ')}`.toLowerCase().includes(needle))
  }, [apiMode, query, catalogue, remoteSlugs])

  return (
    <ModalShell open={open} onClose={onClose} title="Search SkinFox" className="search-modal">
      <span className="eyebrow">Find your everyday essentials</span>
      <h2>A little help finding your care.</h2>
      <p className="search-intro">Search by product, ingredient or the care you’re looking for.</p>
      <label className="search-field">
        <Search size={20} />
        <span className="sr-only">Search products or concerns</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try sunscreen, face wash or Hydrelle" autoFocus />
        {query && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={17} /></button>}
      </label>
      <p className="search-count" role="status" aria-live="polite">{query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'A few thoughtful places to begin'}</p>
      <div className="search-results">
        {results.map((product) => (
          <button type="button" key={product.id} aria-label={`View ${product.name} — ${product.subtitle}`} onClick={() => { onClose(); onView(product) }}>
            <span className="search-result__visual" style={{ background: product.tint }}><ProductVisual product={product} compact /></span>
            <span><small>{product.concern}</small><strong>{product.name}</strong><i>{product.subtitle}</i></span>
            <ArrowRight size={18} />
          </button>
        ))}
        {results.length === 0 && <div className="search-empty"><Search size={24} aria-hidden="true" /><h3>No matches just yet.</h3><p>Try a product name such as “Sun Protect”, or a simpler phrase like “face wash”.</p><button type="button" className="account-text-button" onClick={() => setQuery('')}>Browse suggestions</button></div>}
      </div>
    </ModalShell>
  )
}
