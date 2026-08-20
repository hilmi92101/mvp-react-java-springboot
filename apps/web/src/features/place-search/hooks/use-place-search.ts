import { useCallback, useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '@/app/hooks'

import type { FavouritePlace } from '../types'
import {
  favouriteToggled,
  favouritesRequested,
  historyEntrySelected,
  placeSelected,
  queryChanged,
  searchCleared,
} from '../stores/place-search-slice'
import {
  selectDetailsError,
  selectDetailsPending,
  selectError,
  selectFavouriteError,
  selectHistory,
  selectIsSearching,
  selectQuery,
  selectSelectedPlace,
  selectStatus,
  selectSuggestions,
} from '../stores/selectors'

/**
 * The feature's one entry point.
 *
 * Components inside the feature use this too, not just the page — that is why
 * nothing here is prop-drilled from `pages/place-finder`, and why the page can
 * stay pure layout. Every action is bound and stable, so a component can put
 * one straight into a dependency array.
 *
 * It also owns loading the starred places once per mount: reload-keeps-it-
 * starred is a requirement, and no component should have to remember to ask.
 */
export function usePlaceSearch() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(favouritesRequested())
  }, [dispatch])

  return {
    query: useAppSelector(selectQuery),
    suggestions: useAppSelector(selectSuggestions),
    status: useAppSelector(selectStatus),
    isSearching: useAppSelector(selectIsSearching),
    error: useAppSelector(selectError),
    selected: useAppSelector(selectSelectedPlace),
    detailsPending: useAppSelector(selectDetailsPending),
    detailsError: useAppSelector(selectDetailsError),
    history: useAppSelector(selectHistory),
    favouriteError: useAppSelector(selectFavouriteError),

    setQuery: useCallback((value: string) => dispatch(queryChanged(value)), [dispatch]),
    clearSearch: useCallback(() => dispatch(searchCleared()), [dispatch]),
    selectPlace: useCallback(
      (placeId: string, label: string) => dispatch(placeSelected({ placeId, label })),
      [dispatch],
    ),
    selectHistoryEntry: useCallback(
      (placeId: string) => dispatch(historyEntrySelected(placeId)),
      [dispatch],
    ),
    toggleFavourite: useCallback(
      (place: FavouritePlace) => dispatch(favouriteToggled(place)),
      [dispatch],
    ),
    /** Retry for the error state — re-runs the search for what is typed now. */
    retrySearch: useCallback(
      (value: string) => dispatch(queryChanged(value)),
      [dispatch],
    ),
  }
}
