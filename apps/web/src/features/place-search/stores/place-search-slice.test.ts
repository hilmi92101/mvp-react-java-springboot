import type { FavouritePlace, PlaceSuggestion, SelectedPlace } from '../types'

import {
  favouriteToggleFailed,
  favouriteToggled,
  favouritesLoaded,
  favouritesRequested,
  historyEntrySelected,
  placeDetailsFailed,
  placeDetailsLoaded,
  placeSearchReducer,
  placeSelected,
  queryChanged,
  searchCleared,
  suggestionsFailed,
  suggestionsLoaded,
} from './place-search-slice'
import type { PlaceSearchState } from './place-search-slice'

/**
 * Kept in step with the reducer by hand, on purpose: exporting the constant so
 * the test could import it would make the test agree with any value, including
 * a wrong one.
 */
const HISTORY_LIMIT = 20

/** The reducer's own initial state, obtained the way Redux obtains it. */
const initial = placeSearchReducer(undefined, { type: '@@INIT' })

function state(over: Partial<PlaceSearchState> = {}): PlaceSearchState {
  return { ...initial, ...over }
}

function suggestion(placeId: string): PlaceSuggestion {
  return { placeId, mainText: placeId, secondaryText: 'Malaysia', matches: [] }
}

function place(placeId: string, name = placeId): SelectedPlace {
  return { placeId, name, formattedAddress: `${name}, Malaysia`, lat: 3.1, lng: 101.6 }
}

describe('initial state', () => {
  it('starts idle, empty and unloaded', () => {
    expect(initial).toEqual({
      query: '',
      suggestions: [],
      status: 'idle',
      error: null,
      selected: null,
      detailsPending: false,
      detailsError: null,
      history: [],
      favourites: [],
      favouritesLoaded: false,
      favouriteError: null,
    })
  })
})

describe('queryChanged', () => {
  it('goes to loading for a non-blank query', () => {
    const next = placeSearchReducer(initial, queryChanged('kua'))
    expect(next.query).toBe('kua')
    expect(next.status).toBe('loading')
  })

  it('goes back to idle and drops the list for a blank query', () => {
    const dirty = state({ suggestions: [suggestion('a')], status: 'ready' })
    const next = placeSearchReducer(dirty, queryChanged('   '))
    expect(next.query).toBe('   ')
    expect(next.status).toBe('idle')
    expect(next.suggestions).toEqual([])
  })

  it('clears a previous error', () => {
    const next = placeSearchReducer(state({ error: 'boom', status: 'error' }), queryChanged('k'))
    expect(next.error).toBeNull()
  })
})

describe('suggestionsLoaded', () => {
  it('accepts a response for the current query', () => {
    const next = placeSearchReducer(
      state({ query: 'kuala', status: 'loading' }),
      suggestionsLoaded({ query: 'kuala', suggestions: [suggestion('a')] }),
    )
    expect(next.suggestions.map((s) => s.placeId)).toEqual(['a'])
    expect(next.status).toBe('ready')
  })

  it('matches against the trimmed query', () => {
    const next = placeSearchReducer(
      state({ query: ' kuala ', status: 'loading' }),
      suggestionsLoaded({ query: 'kuala', suggestions: [suggestion('a')] }),
    )
    expect(next.status).toBe('ready')
  })

  it('ignores a response that raced past a newer keystroke', () => {
    const next = placeSearchReducer(
      state({ query: 'kuala', status: 'loading' }),
      suggestionsLoaded({ query: 'ku', suggestions: [suggestion('stale')] }),
    )
    expect(next.suggestions).toEqual([])
    expect(next.status).toBe('loading')
  })

  it('treats "ready" with no rows as the no-results case', () => {
    const next = placeSearchReducer(
      state({ query: 'zzz', status: 'loading' }),
      suggestionsLoaded({ query: 'zzz', suggestions: [] }),
    )
    expect(next.status).toBe('ready')
    expect(next.suggestions).toEqual([])
  })
})

describe('suggestionsFailed', () => {
  it('stores the sentence and empties the list', () => {
    const next = placeSearchReducer(
      state({ query: 'k', suggestions: [suggestion('a')], status: 'loading' }),
      suggestionsFailed("Couldn't reach Google. Try again."),
    )
    expect(next.status).toBe('error')
    expect(next.error).toBe("Couldn't reach Google. Try again.")
    expect(next.suggestions).toEqual([])
  })
})

describe('searchCleared', () => {
  it('resets the search but keeps the selected place on the map', () => {
    const selected = place('a')
    const next = placeSearchReducer(
      state({ query: 'kuala', suggestions: [suggestion('a')], status: 'ready', selected }),
      searchCleared(),
    )
    expect(next).toMatchObject({ query: '', suggestions: [], status: 'idle', error: null })
    expect(next.selected).toBe(selected)
  })
})

describe('placeSelected', () => {
  it('puts the label in the box and starts the details fetch', () => {
    const next = placeSearchReducer(
      state({ query: 'kua', suggestions: [suggestion('a')], status: 'ready', detailsError: 'old' }),
      placeSelected({ placeId: 'a', label: 'Kuala Lumpur' }),
    )
    expect(next.query).toBe('Kuala Lumpur')
    expect(next.suggestions).toEqual([])
    expect(next.status).toBe('idle')
    expect(next.detailsPending).toBe(true)
    expect(next.detailsError).toBeNull()
  })
})

describe('placeDetailsLoaded', () => {
  it('selects the place and pushes a history row carrying the query', () => {
    const next = placeSearchReducer(
      state({ query: 'Kuala Lumpur', detailsPending: true }),
      placeDetailsLoaded(place('a', 'Kuala Lumpur')),
    )
    expect(next.selected).toEqual(place('a', 'Kuala Lumpur'))
    expect(next.detailsPending).toBe(false)
    expect(next.history).toHaveLength(1)
    expect(next.history[0]).toMatchObject({ placeId: 'a', query: 'Kuala Lumpur' })
    expect(typeof next.history[0].searchedAt).toBe('number')
  })

  it('moves a re-picked place to the top instead of stacking a duplicate', () => {
    let next = placeSearchReducer(initial, placeDetailsLoaded(place('a')))
    next = placeSearchReducer(next, placeDetailsLoaded(place('b')))
    next = placeSearchReducer(next, placeDetailsLoaded(place('a')))
    expect(next.history.map((row) => row.placeId)).toEqual(['a', 'b'])
  })

  it(`truncates the history at ${HISTORY_LIMIT} entries, newest first`, () => {
    let next = initial
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      next = placeSearchReducer(next, placeDetailsLoaded(place(`p${i}`)))
    }
    expect(next.history).toHaveLength(HISTORY_LIMIT)
    expect(next.history[0].placeId).toBe(`p${HISTORY_LIMIT + 4}`)
    // The five oldest fell off the end, not the newest.
    expect(next.history.at(-1)?.placeId).toBe('p5')
  })
})

describe('placeDetailsFailed', () => {
  it('stops the spinner and shows the message', () => {
    const next = placeSearchReducer(
      state({ detailsPending: true }),
      placeDetailsFailed("Couldn't load that place. Try another."),
    )
    expect(next.detailsPending).toBe(false)
    expect(next.detailsError).toBe("Couldn't load that place. Try another.")
  })
})

describe('historyEntrySelected', () => {
  const history = [{ ...place('a'), searchedAt: 1, query: 'a' }]

  it('re-selects from the stored row with no network call needed', () => {
    const next = placeSearchReducer(
      state({ history, detailsError: 'old' }),
      historyEntrySelected('a'),
    )
    expect(next.selected).toEqual(history[0])
    // A copy, not the history row itself: mutating one must not touch the other.
    expect(next.selected).not.toBe(history[0])
    expect(next.detailsError).toBeNull()
  })

  it('ignores an id that is not in the history', () => {
    const before = state({ history })
    expect(placeSearchReducer(before, historyEntrySelected('nope'))).toEqual(before)
  })
})

describe('favourites', () => {
  const a: FavouritePlace = place('a')
  const b: FavouritePlace = place('b')

  it('favouritesRequested leaves the list alone so the star does not blank', () => {
    const before = state({ favourites: [a], favouritesLoaded: true })
    expect(placeSearchReducer(before, favouritesRequested())).toEqual(before)
  })

  it('favouritesLoaded marks the list as loaded', () => {
    const next = placeSearchReducer(state({ favouriteError: 'old' }), favouritesLoaded([a]))
    expect(next.favourites).toEqual([a])
    expect(next.favouritesLoaded).toBe(true)
    expect(next.favouriteError).toBeNull()
  })

  it('favouriteToggled stars optimistically, newest first', () => {
    const next = placeSearchReducer(state({ favourites: [b] }), favouriteToggled(a))
    expect(next.favourites.map((f) => f.placeId)).toEqual(['a', 'b'])
  })

  it('favouriteToggled un-stars a place that is already starred', () => {
    const next = placeSearchReducer(state({ favourites: [a, b] }), favouriteToggled(a))
    expect(next.favourites.map((f) => f.placeId)).toEqual(['b'])
  })

  it('favouriteToggleFailed puts back a star that failed to save', () => {
    // wasStarred: false — the optimistic flip added it, so the revert removes it.
    const next = placeSearchReducer(
      state({ favourites: [a, b] }),
      favouriteToggleFailed({ place: a, wasStarred: false, message: "Couldn't save" }),
    )
    expect(next.favourites.map((f) => f.placeId)).toEqual(['b'])
    expect(next.favouriteError).toBe("Couldn't save")
  })

  it('favouriteToggleFailed restores a star that failed to delete', () => {
    const next = placeSearchReducer(
      state({ favourites: [b] }),
      favouriteToggleFailed({ place: a, wasStarred: true, message: "Couldn't save" }),
    )
    expect(next.favourites.map((f) => f.placeId)).toEqual(['a', 'b'])
  })

  it('favouriteToggleFailed is idempotent when the store already agrees', () => {
    // Two stars in flight: the second failure must not double-add or re-remove.
    const next = placeSearchReducer(
      state({ favourites: [a] }),
      favouriteToggleFailed({ place: a, wasStarred: true, message: 'x' }),
    )
    expect(next.favourites.map((f) => f.placeId)).toEqual(['a'])
    expect(next.favouriteError).toBe('x')
  })
})
