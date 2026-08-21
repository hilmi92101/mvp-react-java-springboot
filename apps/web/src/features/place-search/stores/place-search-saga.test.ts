import { all, call, debounce, put, select, takeEvery, takeLatest } from 'redux-saga/effects'

import * as favouritesApi from '../api/favourites-api'
import * as placesSdk from '../api/places-sdk'
import type { FavouritePlace, PlaceSuggestion, SelectedPlace } from '../types'

import {
  DEBOUNCE_MS,
  SUGGESTIONS_ERROR,
  endSession,
  fetchPlaceDetails,
  fetchSuggestions,
  loadFavourites,
  persistFavourite,
  placeSearchSaga,
} from './place-search-saga'
import {
  favouriteToggleFailed,
  favouriteToggled,
  favouritesLoaded,
  favouritesRequested,
  placeDetailsFailed,
  placeDetailsLoaded,
  placeSelected,
  queryChanged,
  searchCleared,
  suggestionsFailed,
  suggestionsLoaded,
} from './place-search-slice'
import { selectIsFavourite } from './selectors'

/**
 * The sagas are tested by stepping each generator and comparing the effect it
 * yields against the same effect builder the saga used. No store, no fake
 * timers and no network: an effect is a plain object, so `debounce` and
 * `takeLatest` are assertable as data rather than as observed behaviour.
 */

// Every failure path logs the real error on purpose. Left unstubbed the suite
// prints stack traces for tests that are passing.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const suggestions: PlaceSuggestion[] = [
  { placeId: 'a', mainText: 'Kuala Lumpur', secondaryText: 'Malaysia', matches: [] },
]

const place: SelectedPlace = {
  placeId: 'a',
  name: 'Kuala Lumpur',
  formattedAddress: 'Kuala Lumpur, Malaysia',
  lat: 3.1,
  lng: 101.6,
}

const favourite: FavouritePlace = place

const boom = new Error('upstream is down')

describe('fetchSuggestions', () => {
  it('trims the query before calling the SDK', () => {
    const saga = fetchSuggestions(queryChanged('  kuala  '))
    expect(saga.next().value).toEqual(call(placesSdk.fetchSuggestions, 'kuala'))
    expect(saga.next(suggestions).value).toEqual(
      put(suggestionsLoaded({ query: 'kuala', suggestions })),
    )
    expect(saga.next().done).toBe(true)
  })

  it('fires no call at all for a blank query', () => {
    // A request for '' is billed and returns nothing.
    for (const blank of ['', '   ']) {
      const saga = fetchSuggestions(queryChanged(blank))
      expect(saga.next().done).toBe(true)
    }
  })

  it('turns an SDK throw into suggestionsFailed', () => {
    const saga = fetchSuggestions(queryChanged('kuala'))
    saga.next()
    expect(saga.throw(boom).value).toEqual(put(suggestionsFailed(SUGGESTIONS_ERROR)))
    expect(saga.next().done).toBe(true)
  })
})

describe('fetchPlaceDetails', () => {
  const action = placeSelected({ placeId: 'a', label: 'Kuala Lumpur' })

  it('loads the place, then resets the session', () => {
    const saga = fetchPlaceDetails(action)
    expect(saga.next().value).toEqual(call(placesSdk.fetchPlaceDetails, 'a'))
    expect(saga.next(place).value).toEqual(put(placeDetailsLoaded(place)))
    // The details call ends the billing session, so the next search must start
    // a new token.
    expect(saga.next().value).toEqual(call(placesSdk.resetSession))
    expect(saga.next().done).toBe(true)
  })

  it('resets the session on the failure path too', () => {
    const saga = fetchPlaceDetails(action)
    saga.next()
    expect(saga.throw(boom).value).toEqual(
      put(placeDetailsFailed("Couldn't load that place. Try another.")),
    )
    expect(saga.next().value).toEqual(call(placesSdk.resetSession))
    expect(saga.next().done).toBe(true)
  })
})

describe('endSession', () => {
  it('clears the token when the × is pressed', () => {
    const saga = endSession()
    expect(saga.next().value).toEqual(call(placesSdk.resetSession))
    expect(saga.next().done).toBe(true)
  })
})

describe('loadFavourites', () => {
  it('puts the list it fetched', () => {
    const saga = loadFavourites()
    expect(saga.next().value).toEqual(call(favouritesApi.listFavourites))
    expect(saga.next([favourite]).value).toEqual(put(favouritesLoaded([favourite])))
    expect(saga.next().done).toBe(true)
  })

  it('swallows a failure — an empty star already says "nothing starred"', () => {
    const saga = loadFavourites()
    saga.next()
    expect(saga.throw(boom).done).toBe(true)
  })
})

describe('persistFavourite', () => {
  it('saves when the optimistic flip starred the place', () => {
    const saga = persistFavourite(favouriteToggled(favourite))
    expect(saga.next().value).toEqual(select(selectIsFavourite, 'a'))
    expect(saga.next(true).value).toEqual(call(favouritesApi.saveFavourite, favourite))
    expect(saga.next().done).toBe(true)
  })

  it('deletes when the optimistic flip un-starred it', () => {
    const saga = persistFavourite(favouriteToggled(favourite))
    saga.next()
    expect(saga.next(false).value).toEqual(call(favouritesApi.removeFavourite, 'a'))
    expect(saga.next().done).toBe(true)
  })

  it('reverts with wasStarred = the state before the flip when a save fails', () => {
    const saga = persistFavourite(favouriteToggled(favourite))
    saga.next()
    saga.next(true)
    expect(saga.throw(boom).value).toEqual(
      put(favouriteToggleFailed({ place: favourite, wasStarred: false, message: "Couldn't save" })),
    )
    expect(saga.next().done).toBe(true)
  })

  it('reverts with wasStarred = true when a delete fails', () => {
    const saga = persistFavourite(favouriteToggled(favourite))
    saga.next()
    saga.next(false)
    expect(saga.throw(boom).value).toEqual(
      put(favouriteToggleFailed({ place: favourite, wasStarred: true, message: "Couldn't save" })),
    )
  })
})

describe('placeSearchSaga', () => {
  it('watches every action with the right strategy', () => {
    const saga = placeSearchSaga()
    expect(saga.next().value).toEqual(
      all([
        debounce(DEBOUNCE_MS, queryChanged.type, fetchSuggestions),
        takeLatest(placeSelected.type, fetchPlaceDetails),
        takeEvery(searchCleared.type, endSession),
        takeLatest(favouritesRequested.type, loadFavourites),
        // takeEvery, not takeLatest: two stars in quick succession are two
        // independent writes.
        takeEvery(favouriteToggled.type, persistFavourite),
      ]),
    )
    expect(saga.next().done).toBe(true)
  })

  it('debounces by 300ms', () => {
    expect(DEBOUNCE_MS).toBe(300)
  })
})
