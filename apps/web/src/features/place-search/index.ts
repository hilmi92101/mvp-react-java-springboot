/**
 * Public API of the place-search feature.
 *
 * The page gets a hook and a layout's worth of components; the store wiring in
 * `app/store.ts` gets the reducer and the saga. Everything else — the slice's
 * actions, the selectors, `places-sdk.ts` — stays internal, which is what keeps
 * the Google SDK from leaking into pages. See docs/architecture/folder-structure.md.
 */
export {
  PlaceAutocompleteInput,
  PlaceDetailsCard,
  PlaceMap,
  SearchHistoryList,
} from './components'
export { usePlaceSearch } from './hooks/use-place-search'
export { placeSearchReducer } from './stores/place-search-slice'
export { placeSearchSaga } from './stores/place-search-saga'
export type { FavouritePlace, PlaceSuggestion, SearchHistoryEntry, SelectedPlace } from './types'
