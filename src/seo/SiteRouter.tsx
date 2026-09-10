import { useEffect, useState } from 'react'
import App from '../App'
import { LegalPage } from '../components/LegalPage'
import { SiteSeo } from './SiteSeo'

function currentPath() { return window.location.pathname.replace(/\/$/, '') || '/' }

export function SiteRouter() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const sync = () => {
      const legacy = window.location.hash === '#privacy-policy' ? '/privacy-policy' : window.location.hash === '#terms-and-conditions' ? '/terms-and-conditions' : ''
      if (legacy) window.history.replaceState(null, '', `${legacy}${window.location.search}`)
      setPath(currentPath())
    }
    sync()
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])
  if (path === '/privacy-policy' || path === '/terms-and-conditions') return <LegalPage kind={path === '/privacy-policy' ? 'privacy' : 'terms'} onBack={() => { window.location.href = '/#top' }} />
  const match = path.match(/^\/products\/([a-zA-Z0-9-]+)$/)
  if (match) return <App key={match[1]} productSlug={match[1]} />
  if (path !== '/') return <main className="product-page shell product-page--message"><SiteSeo page={{ title: 'Page not found | SkinFox', description: 'Return to the SkinFox collection for skin, body, hair and scalp care.', path, noindex: true }} /><h1>This page has moved.</h1><p>Let’s get you back to your care essentials.</p><a className="button button--dark" href="/">Return to SkinFox</a></main>
  return <App />
}
