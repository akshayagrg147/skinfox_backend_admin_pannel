import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProductById } from '../data/products'
import { ScrollProductStory } from './ScrollProductStory'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
const originalMatchMedia = window.matchMedia
const hydrelle = getProductById('hydrelle-dry-skin-specialist')

type QueryState = {
  addEventListener: ReturnType<typeof vi.fn>
  listeners: Set<EventListenerOrEventListenerObject>
  mediaQueryList: MediaQueryList
  removeEventListener: ReturnType<typeof vi.fn>
  setMatches: (matches: boolean) => void
}

function createMatchMediaController(initialReducedMotion: boolean) {
  const queryStates = new Map<string, QueryState>()

  const getQueryState = (query: string) => {
    const existing = queryStates.get(query)
    if (existing) return existing

    let matches = query.includes('prefers-reduced-motion') ? initialReducedMotion : false
    const listeners = new Set<EventListenerOrEventListenerObject>()
    const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') listeners.add(listener)
    })
    const removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') listeners.delete(listener)
    })

    const mediaQueryList = {
      get matches() {
        return matches
      },
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener as EventListener)),
      removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener as EventListener)),
      dispatchEvent: vi.fn(() => true),
    } as unknown as MediaQueryList

    const state: QueryState = {
      addEventListener,
      listeners,
      mediaQueryList,
      removeEventListener,
      setMatches(nextMatches) {
        matches = nextMatches
        const event = { matches, media: query } as MediaQueryListEvent
        for (const listener of [...listeners]) {
          if (typeof listener === 'function') listener.call(mediaQueryList, event)
          else listener.handleEvent(event)
        }
      },
    }
    queryStates.set(query, state)
    return state
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => getQueryState(query).mediaQueryList),
  })

  return {
    getQueryState,
    setReducedMotion(matches: boolean) {
      for (const [query, state] of queryStates) {
        if (query.includes('prefers-reduced-motion')) state.setMatches(matches)
      }
    },
  }
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  })
})

describe('ScrollProductStory', () => {
  it('renders one enhanced product image and opens that product', () => {
    createMatchMediaController(false)
    const onView = vi.fn()

    const { container } = render(<ScrollProductStory product={hydrelle} onView={onView} />)

    expect(container.querySelector('.scroll-story--enhanced')).toBeInTheDocument()
    expect(container.querySelector('.scroll-story--static')).not.toBeInTheDocument()

    const story = screen.getByRole('list', { name: 'SkinFox Hydrelle product' })
    const productItems = within(story).getAllByRole('listitem')
    const productImages = within(story).getAllByRole('img')

    expect(productItems).toHaveLength(1)
    expect(productItems[0]).toHaveAttribute('data-product-id', hydrelle.id)
    expect(productImages).toHaveLength(1)
    expect(productImages[0]).toHaveAttribute('src', hydrelle.storyImage ?? hydrelle.image)
    expect(container.querySelector('.scroll-story__product--hydrelle')).toBeInTheDocument()
    expect(container.querySelector('.scroll-story__bottle-window.is-hydrelle')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'SkinFox Hydrelle story' })).getAllByRole('listitem')).toHaveLength(4)

    fireEvent.click(within(story).getByRole('button', { name: `View ${hydrelle.name} product details` }))
    expect(onView).toHaveBeenCalledOnce()
    expect(onView).toHaveBeenCalledWith(hydrelle)
  })

  it('renders the normal-flow static story when reduced motion is requested', () => {
    createMatchMediaController(true)
    const onView = vi.fn()

    const { container } = render(<ScrollProductStory product={hydrelle} onView={onView} />)

    expect(container.querySelector('.scroll-story--static')).toBeInTheDocument()
    expect(container.querySelector('.scroll-story--enhanced')).not.toBeInTheDocument()

    const story = screen.getByRole('list', { name: 'SkinFox Hydrelle product' })
    expect(within(story).getAllByRole('listitem')).toHaveLength(1)
    expect(within(story).getAllByRole('img')).toHaveLength(1)

    fireEvent.click(within(story).getByRole('button', { name: `View ${hydrelle.name} product details` }))
    expect(onView).toHaveBeenCalledWith(hydrelle)
  })

  it('switches modes on reduced-motion changes and removes its listener on unmount', () => {
    const media = createMatchMediaController(false)
    const { container, unmount } = render(<ScrollProductStory product={hydrelle} onView={vi.fn()} />)
    const reducedState = media.getQueryState(reducedMotionQuery)
    const changeRegistration = reducedState.addEventListener.mock.calls.find(([type]) => type === 'change')

    expect(changeRegistration).toBeDefined()
    expect(container.querySelector('.scroll-story--enhanced')).toBeInTheDocument()

    act(() => media.setReducedMotion(true))
    expect(container.querySelector('.scroll-story--static')).toBeInTheDocument()

    act(() => media.setReducedMotion(false))
    expect(container.querySelector('.scroll-story--enhanced')).toBeInTheDocument()

    const registeredListener = changeRegistration?.[1] as EventListenerOrEventListenerObject
    unmount()
    expect(reducedState.removeEventListener).toHaveBeenCalledWith('change', registeredListener)
    expect(reducedState.listeners).not.toContain(registeredListener)
  })
})
