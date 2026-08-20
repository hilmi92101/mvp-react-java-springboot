import { createSelector } from '@reduxjs/toolkit'

import type { RootState } from '@/app/store'

/**
 * Reads of the slice, kept out of components.
 *
 * `createSelector` earns its place only where a selector *derives* something —
 * a new array or object — because that is where an inline selector would return
 * a fresh reference on every render and re-render forever. The plain field reads
 * below need no memoisation and get none.
 */

const selectPlaceSearch = (state: RootState) => state.placeSearch

export const selectQuery = (state: RootState) => state.placeSearch.query
export const selectSuggestions = (state: RootState) => state.placeSearch.suggestions
export const selectStatus = (state: RootState) => state.placeSearch.status
export const selectError = (state: RootState) => state.placeSearch.error
export const selectSelectedPlace = (state: RootState) => state.placeSearch.selected
export const selectDetailsPending = (state: RootState) => state.placeSearch.detailsPending
export const selectDetailsError = (state: RootState) => state.placeSearch.detailsError
export const selectHistory = (state: RootState) => state.placeSearch.history
export const selectFavourites = (state: RootState) => state.placeSearch.favourites
export const selectFavouriteError = (state: RootState) => state.placeSearch.favouriteError

/**
 * Whether one place id is starred.
 *
 * Parameterised, so it takes the place id as the selector's second argument
 * rather than being a factory — `useAppSelector((s) => selectIsFavourite(s, id))`
 * and `select(selectIsFavourite, id)` in a saga both work, and neither creates a
 * new selector per render.
 */
export const selectIsFavourite = (state: RootState, placeId: string): boolean =>
  state.placeSearch.favourites.some((row) => row.placeId === placeId)

/**
 * True while the dropdown should show a spinner. Derived rather than read so
 * the components do not each re-decide what "busy" means.
 */
export const selectIsSearching = createSelector(
  selectPlaceSearch,
  (slice) => slice.status === 'loading',
)
