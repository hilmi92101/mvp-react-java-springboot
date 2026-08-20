import type { PlaceSuggestion, SelectedPlace } from '../types'

/**
 * The only file in the app that touches `google.maps`.
 *
 * Everything above it — slice, saga, selectors — deals in the plain records
 * from `../types`, which is what keeps them testable without a browser and a
 * billed API key.
 *
 * Two APIs are in play and they are easy to confuse: this uses the
 * **Autocomplete Data API** (`AutocompleteSuggestion`), not the
 * `PlaceAutocompleteElement` widget. The widget owns its own dropdown and never
 * hands over the intermediate predictions, so it cannot satisfy the requirement
 * that every search be stored and listed. See the plan's Question #2.
 */

/** Bias, not filter: Malaysian places rank first, Tokyo is still findable. */
const REGION = 'my'

/** Requested only on the terminating details call — see `fetchPlaceDetails`. */
const DETAIL_FIELDS = ['displayName', 'formattedAddress', 'location']

/**
 * `<APIProvider>` loads the Maps bootstrap, which is what defines
 * `google.maps.importLibrary`. The saga can run before that finishes (the user
 * types fast, or the network is slow), so every entry point waits here first
 * instead of throwing `google is not defined` at the reducer.
 */
function waitForMapsBootstrap(timeoutMs = 10_000): Promise<void> {
  const ready = () => typeof google !== 'undefined' && Boolean(google.maps?.importLibrary)
  if (ready()) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const startedAt = performance.now()
    const tick = () => {
      if (ready()) return resolve()
      if (performance.now() - startedAt > timeoutMs) {
        return reject(new Error('The Google Maps SDK never finished loading.'))
      }
      setTimeout(tick, 50)
    }
    tick()
  })
}

/**
 * Loaded once and reused. `importLibrary` caches internally too, but holding
 * the promise here means a burst of keystrokes shares one load instead of
 * racing on it.
 */
let placesLibrary: Promise<google.maps.PlacesLibrary> | null = null

async function places(): Promise<google.maps.PlacesLibrary> {
  await waitForMapsBootstrap()
  placesLibrary ??= google.maps.importLibrary('places') as Promise<google.maps.PlacesLibrary>
  return placesLibrary
}

/**
 * The current session token, or null when a new search is about to start.
 *
 * Money, not tidiness: with a token, every keystroke of one search is billed as
 * a single session, and because our terminating details call asks for a Pro
 * field (`displayName`) the autocomplete requests themselves come out at $0.
 * Two rules that void that — both handled by `resetSession()` — are reusing a
 * token after a place has been picked, and sharing one across searches.
 * See the plan's Question #12.
 */
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

async function currentSessionToken(): Promise<google.maps.places.AutocompleteSessionToken> {
  const { AutocompleteSessionToken } = await places()
  sessionToken ??= new AutocompleteSessionToken()
  return sessionToken
}

/** Ends the session. Called after a place is picked, and by the clear button. */
export function resetSession(): void {
  sessionToken = null
}

/**
 * The `Place` object Google handed us for each prediction, kept out of Redux.
 *
 * Session billing wants the details call to be made on the very object the
 * prediction produced (`placePrediction.toPlace()`), but that object is not
 * serializable and must not enter a slice. So the slice holds the place id and
 * this map holds the object, keyed by that id. A miss is survivable —
 * `fetchPlaceDetails` falls back to constructing a `Place` from the id, which
 * costs the session discount but still returns the right place.
 */
const predictedPlaces = new Map<string, google.maps.places.Place>()

/**
 * Autocomplete for what the user has typed.
 *
 * The caller is responsible for debouncing and for dropping stale responses;
 * the saga does both (`debounce` + `takeLatest`).
 */
export async function fetchSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const { AutocompleteSuggestion } = await places()

  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    region: REGION,
    sessionToken: await currentSessionToken(),
  })

  return suggestions.flatMap((suggestion) => {
    const prediction = suggestion.placePrediction
    // A suggestion can be a query refinement rather than a place, and those
    // carry no placeId. flatMap so they drop out instead of becoming a row
    // that cannot be clicked.
    if (!prediction?.placeId) return []

    predictedPlaces.set(prediction.placeId, prediction.toPlace())

    return [{
      placeId: prediction.placeId,
      mainText: prediction.mainText?.text ?? prediction.text.text,
      secondaryText: prediction.secondaryText?.text ?? '',
      matches: (prediction.mainText?.matches ?? []).map((match) => ({
        startOffset: match.startOffset,
        endOffset: match.endOffset,
      })),
    }]
  })
}

/**
 * The terminating call of a session: name, address and coordinates for one
 * place.
 *
 * `displayName` is what makes this a **Pro** SKU (5,000 free calls a month
 * instead of 10,000 Essentials ones), and that is a deliberate trade — a
 * details card with an address and no place name is not useful, and a Pro
 * terminating call is what makes the whole session's autocomplete free.
 * See the plan's Question #8.
 */
export async function fetchPlaceDetails(placeId: string): Promise<SelectedPlace> {
  const { Place } = await places()
  const place = predictedPlaces.get(placeId) ?? new Place({ id: placeId })

  await place.fetchFields({ fields: DETAIL_FIELDS })

  const location = place.location
  if (!location) {
    throw new Error('Google returned no coordinates for that place.')
  }

  return {
    placeId,
    name: place.displayName ?? place.formattedAddress ?? 'Unnamed place',
    formattedAddress: place.formattedAddress ?? '',
    lat: location.lat(),
    lng: location.lng(),
  }
}
