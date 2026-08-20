/**
 * The feature's data shapes. All plain and serializable on purpose: everything
 * here lives in Redux, and a `google.maps.Place` or `LatLng` instance would
 * trip the store's serializability check (and could not survive DevTools time
 * travel). The SDK objects stay behind `api/places-sdk.ts`.
 */

/** One character range Google says matched what the user typed. */
export interface TextMatch {
  startOffset: number
  endOffset: number
}

/** One row in the autocomplete dropdown. */
export interface PlaceSuggestion {
  /** Google's place id — the only handle the rest of the app ever holds. */
  placeId: string
  /** "Kuala Lumpur" — rendered bold. */
  mainText: string
  /** "Federal Territory of Kuala Lumpur, Malaysia" — rendered muted. */
  secondaryText: string
  /** Ranges inside `mainText` that matched the query, for the bolding. */
  matches: TextMatch[]
}

/** A place after its details have been fetched — enough to render and to map. */
export interface SelectedPlace {
  placeId: string
  name: string
  formattedAddress: string
  lat: number
  lng: number
}

/**
 * One row in the session's search history.
 *
 * A "search" is one *selected place*, not one debounced keystroke — see
 * docs/plans/place-autocomplete.md Question #10. That is what makes a row
 * clickable: clicking it puts the place back on the map.
 */
export interface SearchHistoryEntry extends SelectedPlace {
  /** Epoch ms. Sort key, and what the row shows as a time. */
  searchedAt: number
  /** What the user had typed when they picked this place. */
  query: string
}

/** A starred place, as stored by the API. */
export type FavouritePlace = SelectedPlace

/**
 * The dropdown has four visible states and this is the discriminator for all
 * of them. `ready` with an empty `suggestions` array is the "no results" case —
 * it needs no status of its own, and inventing one would let the two disagree.
 */
export type SuggestionsStatus = 'idle' | 'loading' | 'ready' | 'error'
