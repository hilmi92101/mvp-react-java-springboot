/**
 * The smoke test for Stage A1: proves Vitest runs, the jsdom environment is
 * live, `globals: true` works, and the `@/` alias resolves from a test file.
 */
import { placeSearchReducer } from '@/features/place-search/stores/place-search-slice'

describe('test harness', () => {
  it('runs in jsdom', () => {
    expect(typeof document).toBe('object')
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement)
  })

  it('resolves the @/ alias', () => {
    expect(typeof placeSearchReducer).toBe('function')
  })
})
