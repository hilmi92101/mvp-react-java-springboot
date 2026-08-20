import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type {
  FavouritePlace,
  PlaceSuggestion,
  SearchHistoryEntry,
  SelectedPlace,
  SuggestionsStatus,
} from '../types'

/**
 * All of the feature's state, and all of it plain data.
 *
 * The search history lives here and nowhere else: it is a *session* list by
 * decision, not an oversight — only favourites reach MSSQL. See the plan's
 * Question #5.
 */
export interface PlaceSearchState {
  /** What is in the textbox. The saga debounces changes to it. */
  query: string
  suggestions: PlaceSuggestion[]
  status: SuggestionsStatus
  /** User-facing sentence for the `error` status. Never a raw stack. */
  error: string | null

  selected: SelectedPlace | null
  detailsPending: boolean
  detailsError: string | null

  /** Newest first. One entry per selected place. */
  history: SearchHistoryEntry[]

  favourites: FavouritePlace[]
  /** Set once the initial GET lands, so the star does not flicker on load. */
  favouritesLoaded: boolean
  favouriteError: string | null
}

/** Keeps the session list from growing without bound on a long sitting. */
const HISTORY_LIMIT = 20

const initialState: PlaceSearchState = {
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
}

const placeSearchSlice = createSlice({
  name: 'placeSearch',
  initialState,
  reducers: {
    /**
     * Every keystroke. The saga debounces this action rather than the
     * component debouncing its own onChange, so the textbox stays a controlled
     * input with no timer of its own.
     */
    queryChanged(state, action: PayloadAction<string>) {
      state.query = action.payload
      state.error = null
      if (action.payload.trim() === '') {
        // An empty input shows no dropdown at all — not an empty box.
        state.suggestions = []
        state.status = 'idle'
      } else {
        // Set here, not when the debounced request fires: the spinner should
        // answer the keystroke, not appear 300ms after it.
        state.status = 'loading'
      }
    },

    suggestionsLoaded(
      state,
      action: PayloadAction<{ query: string; suggestions: PlaceSuggestion[] }>,
    ) {
      // Belt to the saga's braces. `takeLatest`-style cancellation already
      // drops stale requests, but a response that raced past it must not
      // replace the list for a query the user has moved on from.
      if (action.payload.query !== state.query.trim()) return
      state.suggestions = action.payload.suggestions
      state.status = 'ready'
    },

    suggestionsFailed(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
      state.suggestions = []
    },

    /** The × button. Leaves `selected` alone: the map keeps its place. */
    searchCleared(state) {
      state.query = ''
      state.suggestions = []
      state.status = 'idle'
      state.error = null
    },

    /**
     * A row was picked. `label` is the text to leave in the box, which the
     * component knows and the store would otherwise have to look up.
     */
    placeSelected(state, action: PayloadAction<{ placeId: string; label: string }>) {
      state.query = action.payload.label
      state.suggestions = []
      state.status = 'idle'
      state.detailsPending = true
      state.detailsError = null
    },

    placeDetailsLoaded(state, action: PayloadAction<SelectedPlace>) {
      const place = action.payload
      state.selected = place
      state.detailsPending = false

      // Deduped by place id: picking the same place twice moves it to the top
      // rather than stacking two identical rows.
      state.history = [
        { ...place, searchedAt: Date.now(), query: state.query },
        ...state.history.filter((entry) => entry.placeId !== place.placeId),
      ].slice(0, HISTORY_LIMIT)
    },

    placeDetailsFailed(state, action: PayloadAction<string>) {
      state.detailsPending = false
      state.detailsError = action.payload
    },

    /** A history row was clicked. No network call — the entry has everything. */
    historyEntrySelected(state, action: PayloadAction<string>) {
      const entry = state.history.find((row) => row.placeId === action.payload)
      if (!entry) return
      state.selected = { ...entry }
      state.detailsError = null
    },

    favouritesRequested() {
      // Saga trigger. State is untouched: the star renders from `favourites`,
      // and blanking it here would make a refresh look like an un-star.
    },

    favouritesLoaded(state, action: PayloadAction<FavouritePlace[]>) {
      state.favourites = action.payload
      state.favouritesLoaded = true
      state.favouriteError = null
    },

    /**
     * The optimistic half of the star: flips immediately, the saga catches up.
     * A star that waits for a round trip feels broken at 200ms.
     */
    favouriteToggled(state, action: PayloadAction<FavouritePlace>) {
      const place = action.payload
      const starred = state.favourites.some((row) => row.placeId === place.placeId)
      state.favourites = starred
        ? state.favourites.filter((row) => row.placeId !== place.placeId)
        : [place, ...state.favourites]
      state.favouriteError = null
    },

    /**
     * The revert. `wasStarred` is the state *before* the optimistic flip, which
     * the saga read off the store — replaying the toggle would be wrong if two
     * stars were in flight at once.
     */
    favouriteToggleFailed(
      state,
      action: PayloadAction<{ place: FavouritePlace; wasStarred: boolean; message: string }>,
    ) {
      const { place, wasStarred, message } = action.payload
      const present = state.favourites.some((row) => row.placeId === place.placeId)
      if (wasStarred && !present) {
        state.favourites = [place, ...state.favourites]
      } else if (!wasStarred && present) {
        state.favourites = state.favourites.filter((row) => row.placeId !== place.placeId)
      }
      state.favouriteError = message
    },
  },
})

export const {
  queryChanged,
  suggestionsLoaded,
  suggestionsFailed,
  searchCleared,
  placeSelected,
  placeDetailsLoaded,
  placeDetailsFailed,
  historyEntrySelected,
  favouritesRequested,
  favouritesLoaded,
  favouriteToggled,
  favouriteToggleFailed,
} = placeSearchSlice.actions

export const placeSearchReducer = placeSearchSlice.reducer
