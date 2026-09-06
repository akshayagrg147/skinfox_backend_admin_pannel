import { ArrowRight, Search } from 'lucide-react'
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
      <span className="eyebrow">Search the edit</span>
      <h2>What kind of care are you looking for?</h2>
      <label className="search-field">
        <Search size={20} />
        <span className="sr-only">Search products or concerns</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try suncream, face wash or Hydrelle" autoFocus />
      </label>
      <p className="search-count">{query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'A few thoughtful places to begin'}</p>
      <div className="search-results">
        {results.map((product) => (
          <button key={product.id} onClick={() => { onClose(); onView(product) }}>
            <span className="search-result__visual" style={{ background: product.tint }}><ProductVisual product={product} compact /></span>
            <span><small>{product.concern}</small><strong>{product.name}</strong><i>{product.subtitle}</i></span>
            <ArrowRight size={18} />
          </button>
        ))}
        {results.length === 0 && <p className="search-empty">No exact match yet. Try “Sun Protect”, “face wash” or “Hydrelle”.</p>}
      </div>
    </ModalShell>
  )
}
