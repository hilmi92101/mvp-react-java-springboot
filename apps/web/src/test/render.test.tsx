import { Search } from 'lucide-react'

import { queryChanged } from '@/features/place-search/stores/place-search-slice'

import { renderWithProviders } from './render'

/**
 * The isolation guarantee itself, asserted once here rather than assumed by
 * every component test: a store leaking between tests is the failure this
 * helper exists to prevent, and it would otherwise only show up as an
 * order-dependent red in some unrelated file.
 */

function Probe() {
  return <Search aria-label="probe" />
}

describe('renderWithProviders', () => {
  it('gives each render its own store', () => {
    const first = renderWithProviders(<Probe />)
    first.store.dispatch(queryChanged('kuala'))
    expect(first.store.getState().placeSearch.query).toBe('kuala')

    const second = renderWithProviders(<Probe />)
    expect(second.store.getState().placeSearch.query).toBe('')
  })

  it('starts from the reducer initial state, overlaid with preloadedState', () => {
    const { store } = renderWithProviders(<Probe />, {
      preloadedState: { placeSearch: { query: 'ipoh', status: 'loading' } },
    })

    const state = store.getState().placeSearch
    expect(state.query).toBe('ipoh')
    expect(state.status).toBe('loading')
    // Untouched keys still come from the reducer, not from undefined.
    expect(state.suggestions).toEqual([])
    expect(state.favouritesLoaded).toBe(false)
  })

  it('records dispatched actions in order', () => {
    const { store, dispatched } = renderWithProviders(<Probe />)

    store.dispatch(queryChanged('a'))
    store.dispatch(queryChanged('ab'))

    expect(dispatched.map((action) => action.type)).toEqual([
      queryChanged.type,
      queryChanged.type,
    ])
  })

  it('renders inside a router, so a <Link> does not throw', () => {
    expect(() => renderWithProviders(<Probe />, { route: '/apps' })).not.toThrow()
  })
})
