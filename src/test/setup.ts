import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Node 25 can expose an experimental global `localStorage` when the test
// runner is launched with --localstorage-file. It is not the jsdom Storage
// implementation and does not provide clear/getItem. Keep browser tests
// deterministic by using the jsdom instance whenever that happens.
if (typeof globalThis.localStorage?.getItem !== 'function' || typeof globalThis.localStorage?.clear !== 'function') {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => { values.clear() },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  } as Storage
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage })
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
}

afterEach(() => {
  cleanup()
  document.body.className = ''
})

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}

Object.defineProperty(window, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: IntersectionObserverMock,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
