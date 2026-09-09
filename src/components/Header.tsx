import { AnimatePresence, motion } from 'framer-motion'
import { Bell, ChevronDown, ClipboardList, CircleDollarSign, LogOut, MapPin, Menu, Search, ShoppingBag, Sparkles, UserRound, WalletCards, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BrandMark } from './BrandMark'
import type { AccountSection } from './CustomerAccount'

type HeaderProps = {
  cartCount: number
  onCart: () => void
  onQuiz: () => void
  onSearch: () => void
  onAccount: (section?: AccountSection) => void
  onLogout?: () => void
  customerName?: string | null
}

export function Header({ cartCount, onCart, onQuiz, onSearch, onAccount, onLogout, customerName }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!accountMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [accountMenuOpen])

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
            <div className="header-account-wrap" ref={accountMenuRef}>
              <button className={`icon-button header-account ${customerName ? 'header-account--signed-in' : ''}`} onClick={() => customerName ? setAccountMenuOpen((open) => !open) : onAccount('profile')} aria-expanded={customerName ? accountMenuOpen : undefined} aria-haspopup={customerName ? 'menu' : undefined} aria-label={customerName ? `Open account for ${customerName}` : 'Sign in or open account'}>
                <UserRound size={19} />
                {customerName && <><span className="header-account__name">{customerName}</span><ChevronDown size={14} className={`header-account__chevron ${accountMenuOpen ? 'is-open' : ''}`} /></>}
              </button>
              {customerName && accountMenuOpen && <AccountMenu onAccount={(section) => { setAccountMenuOpen(false); onAccount(section) }} onLogout={() => { setAccountMenuOpen(false); onLogout?.() }} />}
            </div>
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

function AccountMenu({ onAccount, onLogout }: { onAccount: (section: AccountSection) => void; onLogout: () => void }) {
  const items: Array<{ section: AccountSection; label: string; icon: typeof UserRound }> = [
    { section: 'profile', label: 'My Profile', icon: UserRound },
    { section: 'orders', label: 'Orders', icon: ClipboardList },
    { section: 'supercoin', label: 'Supercoin', icon: CircleDollarSign },
    { section: 'wallet', label: 'Saved Cards & Wallet', icon: WalletCards },
    { section: 'addresses', label: 'Saved Addresses', icon: MapPin },
    { section: 'notifications', label: 'Notifications', icon: Bell },
  ]
  return <div className="account-popover" role="menu" aria-label="Your account">
    <div className="account-popover__heading"><span>Your Account</span><small>Manage your SkinFox space</small></div>
    {items.map(({ section, label, icon: Icon }) => <button key={section} type="button" role="menuitem" className="account-popover__item" onClick={() => onAccount(section)}><Icon size={18} /><span>{label}</span><ChevronDown size={14} className="account-popover__arrow" /></button>)}
    <button type="button" role="menuitem" className="account-popover__item account-popover__item--logout" onClick={onLogout}><LogOut size={18} /><span>Logout</span></button>
  </div>
}
