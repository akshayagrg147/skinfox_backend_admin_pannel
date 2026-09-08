import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Search, ShoppingBag, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrandMark } from './BrandMark'

type HeaderProps = {
  cartCount: number
  onCart: () => void
  onQuiz: () => void
  onSearch: () => void
  onAccount: () => void
  customerName?: string | null
}

export function Header({ cartCount, onCart, onQuiz, onSearch, onAccount, customerName }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    document.body.classList.add('is-locked')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('is-locked')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  const navigate = () => setMobileOpen(false)

  return (
    <>
      <header className={`site-header ${scrolled ? 'site-header--scrolled' : ''}`}>
        <div className="site-header__inner shell">
          <button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <a href="#top" className="brand-link" aria-label="SkinFox home">
            <BrandMark />
          </a>
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#shop">Shop</a>
            <button onClick={onQuiz}>Care finder</button>
            <a href="#ingredients">On the label</a>
            <a href="#story">Our story</a>
          </nav>
          <div className="header-actions">
            <button className="header-quiz" onClick={onQuiz}>
              <Sparkles size={15} /> Find my care
            </button>
            <button className="icon-button header-account" onClick={onAccount} aria-label={customerName ? `Open account for ${customerName}` : 'Sign in or open account'}>
              <UserRound size={19} />
            </button>
            <button className="icon-button header-search" onClick={onSearch} aria-label="Search products">
              <Search size={19} />
            </button>
            <button className="icon-button cart-button" onClick={onCart} aria-label={`Open bag with ${cartCount} items`}>
              <ShoppingBag size={19} />
              {cartCount > 0 && <span>{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="mobile-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="mobile-menu__panel" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}>
              <div className="mobile-menu__top">
                <BrandMark compact />
                <button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              <nav aria-label="Mobile navigation">
                <a href="#shop" onClick={navigate}>Shop the collection</a>
                <button onClick={() => { navigate(); onAccount() }}>My account</button>
                <button onClick={() => { navigate(); onQuiz() }}>Find my care</button>
                <a href="#ingredients" onClick={navigate}>Label transparency</a>
                <a href="#story" onClick={navigate}>Our story</a>
                <a href="#faq" onClick={navigate}>Questions, answered</a>
              </nav>
              <p>Beautiful care from root to skin.</p>
            </motion.div>
            <button className="mobile-menu__scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
