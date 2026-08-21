import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Runs before every test file. Two jobs, both of which are the kind of thing
 * that only shows up as a mystery failure in the *second* test of a file.
 */

// Testing Library only auto-cleans when it can see a global `afterEach`, which
// it can here — but relying on that means the day someone sets
// `globals: false` the leftover DOM starts breaking unrelated tests.
afterEach(() => {
  cleanup()
})

// jsdom implements neither of these, and both are reached by real components:
// ResizeObserver by anything measuring itself, matchMedia by Tailwind-driven
// responsive logic. Left unstubbed they throw as "not a constructor".
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub

// jsdom has no layout, so it ships no scrollIntoView at all -- the property is
// simply absent and a call throws "not a function". Any component that keeps a
// highlighted row visible reaches it, which in this app is the autocomplete
// dropdown's arrow-key handling.
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof globalThis.matchMedia
