import type { PayloadAction } from '@reduxjs/toolkit'
import { all, call, debounce, put, select, takeEvery, takeLatest } from 'redux-saga/effects'

import * as favouritesApi from '../api/favourites-api'
import * as placesSdk from '../api/places-sdk'
import type { FavouritePlace, PlaceSuggestion, SelectedPlace } from '../types'

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
 * Every side effect in the feature, in one file.
 *
 * Saga rather than thunks because autocomplete is a debounce-and-cancel
 * problem: `debounce` collapses a burst of keystrokes into one request, and
 * `takeLatest` guarantees a slow response for "ku" can never overwrite the list
 * for "kuala". Both are one line here and a hand-rolled timer plus a request-id
 * counter otherwise. See the plan's Question #3.
 *
 * The workers below are exported for the tests, which step each generator and
 * assert the effects it yields. Nothing outside this file and its test should
 * import them -- `placeSearchSaga` is the only entry point the store wires up.
 */

/** Long enough to collapse normal typing, short enough not to feel laggy. */
export const DEBOUNCE_MS = 300

/** What the user sees when Google cannot be reached. */
export const SUGGESTIONS_ERROR = "Couldn't reach Google. Try again."

export function* fetchSuggestions(action: PayloadAction<string>) {
  const query = action.payload.trim()
  // The reducer already emptied the list for a blank input; firing a request
  // for '' would be billed and return nothing.
  if (query === '') return

  try {
    const suggestions = (yield call(placesSdk.fetchSuggestions, query)) as PlaceSuggestion[]
    yield put(suggestionsLoaded({ query, suggestions }))
  } catch (error) {
    // The real message goes to the console for us; the user gets a sentence.
    console.error('[place-search] autocomplete failed', error)
    yield put(suggestionsFailed(SUGGESTIONS_ERROR))
  }
}

export function* fetchPlaceDetails(action: PayloadAction<{ placeId: string; label: string }>) {
  try {
    const place = (yield call(
      placesSdk.fetchPlaceDetails,
      action.payload.placeId,
    )) as SelectedPlace
    yield put(placeDetailsLoaded(place))
  } catch (error) {
    console.error('[place-search] place details failed', error)
    yield put(placeDetailsFailed("Couldn't load that place. Try another."))
  } finally {
    // The details call is what ends a billing session, so the next search must
    // start a new token — win or lose. Reusing one voids the session and
    // reverts the whole search to per-keystroke billing.
    yield call(placesSdk.resetSession)
  }
}

/** The × button also ends the session: what follows is a different search. */
export function* endSession() {
  yield call(placesSdk.resetSession)
}

export function* loadFavourites() {
  try {
    const favourites = (yield call(favouritesApi.listFavourites)) as FavouritePlace[]
    yield put(favouritesLoaded(favourites))
  } catch (error) {
    console.error('[place-search] loading favourites failed', error)
    // No user-facing error: an unreachable API on load means "nothing is
    // starred yet", which is what an empty star already says.
  }
}

/**
 * The persistence half of the optimistic star. The reducer has already flipped
 * the UI by the time this runs, so `wasStarred` is read as the state *before*
 * that flip — hence the `!`.
 */
export function* persistFavourite(action: PayloadAction<FavouritePlace>) {
  const place = action.payload
  const isStarredNow = (yield select(selectIsFavourite, place.placeId)) as boolean
  const wasStarred = !isStarredNow

  try {
    if (isStarredNow) {
      yield call(favouritesApi.saveFavourite, place)
    } else {
      yield call(favouritesApi.removeFavourite, place.placeId)
    }
  } catch (error) {
    console.error('[place-search] saving the favourite failed', error)
    yield put(favouriteToggleFailed({ place, wasStarred, message: "Couldn't save" }))
  }
}

export function* placeSearchSaga() {
  yield all([
    debounce(DEBOUNCE_MS, queryChanged.type, fetchSuggestions),
    takeLatest(placeSelected.type, fetchPlaceDetails),
    takeEvery(searchCleared.type, endSession),
    takeLatest(favouritesRequested.type, loadFavourites),
    // takeEvery, not takeLatest: two different places starred in quick
    // succession are two independent writes, and cancelling the first would
    // leave the UI showing a star that was never stored.
    takeEvery(favouriteToggled.type, persistFavourite),
  ])
}
