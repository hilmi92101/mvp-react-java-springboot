import type { RootState } from '@/app/store'

import type { FavouritePlace, SearchHistoryEntry, SelectedPlace } from '../types'

import type { PlaceSearchState } from './place-search-slice'
import { placeSearchReducer } from './place-search-slice'
import {
  selectDetailsError,
  selectDetailsPending,
  selectError,
  selectFavouriteError,
  selectFavourites,
  selectHistory,
  selectIsFavourite,
  selectIsSearching,
  selectQuery,
  selectSelectedPlace,
  selectStatus,
  selectSuggestions,
} from './selectors'

const initial = placeSearchReducer(undefined, { type: '@@INIT' })

/** The selectors only ever read `state.placeSearch`, so that is all we build. */
function root(over: Partial<PlaceSearchState> = {}): RootState {
  return { placeSearch: { ...initial, ...over } }
}

function place(placeId: string): SelectedPlace {
  return { placeId, name: placeId, formattedAddress: 'Malaysia', lat: 3.1, lng: 101.6 }
}

function historyEntry(placeId: string, searchedAt: number): SearchHistoryEntry {
  return { ...place(placeId), searchedAt, query: placeId }
}

describe('plain field selectors', () => {
  it('read straight through', () => {
    const selected = place('a')
    const favourites: FavouritePlace[] = [place('b')]
    const state = root({
      query: 'kuala',
      suggestions: [{ placeId: 'a', mainText: 'A', secondaryText: 'B', matches: [] }],
      status: 'ready',
      error: 'e',
      selected,
      detailsPending: true,
      detailsError: 'de',
      history: [historyEntry('a', 1)],
      favourites,
      favouriteError: 'fe',
    })

    expect(selectQuery(state)).toBe('kuala')
    expect(selectSuggestions(state)).toHaveLength(1)
    expect(selectStatus(state)).toBe('ready')
    expect(selectError(state)).toBe('e')
    expect(selectSelectedPlace(state)).toBe(selected)
    expect(selectDetailsPending(state)).toBe(true)
    expect(selectDetailsError(state)).toBe('de')
    expect(selectFavourites(state)).toBe(favourites)
    expect(selectFavouriteError(state)).toBe('fe')
  })
})

describe('selectHistory', () => {
  it('hands back the slice order — newest first — without re-sorting', () => {
    // The reducer owns the ordering; a selector that sorted too would let the
    // two disagree.
    const state = root({ history: [historyEntry('new', 200), historyEntry('old', 100)] })
    expect(selectHistory(state).map((row) => row.placeId)).toEqual(['new', 'old'])
  })
})

describe('selectIsFavourite', () => {
  it('is true for a starred place id', () => {
    expect(selectIsFavourite(root({ favourites: [place('a')] }), 'a')).toBe(true)
  })

  it('is false for an unstarred id, and for an empty list', () => {
    expect(selectIsFavourite(root({ favourites: [place('a')] }), 'b')).toBe(false)
    expect(selectIsFavourite(root(), 'a')).toBe(false)
  })
})

describe('selectIsSearching', () => {
  it('is true only for the loading status', () => {
    expect(selectIsSearching(root({ status: 'loading' }))).toBe(true)
    for (const status of ['idle', 'ready', 'error'] as const) {
      expect(selectIsSearching(root({ status }))).toBe(false)
    }
  })

  it('memoises on the slice reference', () => {
    const state = root({ status: 'loading' })
    selectIsSearching.resetRecomputations()
    selectIsSearching(state)
    selectIsSearching(state)
    expect(selectIsSearching.recomputations()).toBe(1)
  })
})
