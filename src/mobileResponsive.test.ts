import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
const polishStyles = readFileSync(resolve(process.cwd(), 'src/storefront-polish.css'), 'utf8')

describe('mobile responsive stylesheet contracts', () => {
  it('keeps the waitlist banner visible and the floating header below it while scrolling', () => {
    expect(polishStyles).toMatch(/\.announcement \{[^}]*position: sticky;[^}]*top: 0;/)
    expect(polishStyles).toMatch(/\.announcement \{[^}]*z-index: 118;/)
    expect(polishStyles).toMatch(/\.site-header--scrolled \{ top: 46px; \}/)
    expect(polishStyles).toMatch(/@media \(max-width: 680px\) \{[\s\S]*?\.site-header--scrolled \{ top: 44px; \}/)
  })

  it('keeps the slide-out menu constrained to the phone viewport and independently scrollable', () => {
    const mobileMenu = styles.slice(styles.indexOf('.mobile-menu__panel {'), styles.indexOf('.mobile-menu__top {'))

    expect(mobileMenu).toContain('height: 100dvh;')
    expect(mobileMenu).toContain('overflow-y: auto;')
    expect(mobileMenu).toContain('overscroll-behavior: contain;')
    expect(styles).toMatch(/\.mobile-menu nav \{[\s\S]*?flex: 0 0 auto;/)
    expect(styles).toMatch(/\.mobile-menu__panel > p \{[\s\S]*?flex: 0 0 auto;/)
    expect(styles).toMatch(/@media \(max-width: 560px\) \{[\s\S]*?\.mobile-menu__panel \{[\s\S]*?width: 100vw;/)
    expect(styles).toMatch(/\.mobile-menu nav a:last-child \{[\s\S]*?white-space: nowrap;/)
  })

  it('uses a two-column hero product gallery and readable labels on phone widths', () => {
    const mobileRules = styles.slice(styles.lastIndexOf('/* Mobile readability baseline:'), styles.indexOf('@media (max-width: 380px)'))

    expect(styles).toMatch(/\.hero-collection__grid,\s*\.hero-collection__grid\.is-expanded \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
    expect(mobileRules).toContain('font-size: 0.625rem;')
    expect(mobileRules).toContain('font-size: clamp(0.95rem, 4.45vw, 1.05rem);')
  })

  it('keeps the hero collection inside the viewport on short desktop viewports', () => {
    expect(styles).toMatch(/@media \(min-width: 821px\) and \(max-height: 900px\) \{[\s\S]*?\.hero \{[\s\S]*?min-height: max\(calc\(100svh - 34px\), 760px\);/)
    expect(styles).toMatch(/@media \(min-width: 821px\) and \(max-height: 900px\) \{[\s\S]*?\.hero__visual--collection \{[\s\S]*?min-height: 0;/)
    expect(styles).not.toMatch(/hero-collection__count/)
  })
})
