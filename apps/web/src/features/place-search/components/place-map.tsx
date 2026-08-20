import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'

import { usePlaceSearch } from '../hooks/use-place-search'

/**
 * The map, and the marker on the picked place.
 *
 * Must be rendered inside the `<APIProvider>` the page sets up — that provider
 * is what loads the SDK this component and `places-sdk.ts` both use.
 */

/** Kuala Lumpur. A default centre so the page never opens on empty ocean. */
const DEFAULT_CENTRE = { lat: 3.139, lng: 101.6869 }
const DEFAULT_ZOOM = 11
/** Close enough to see the building, wide enough to keep the street context. */
const SELECTED_ZOOM = 16

export function PlaceMap() {
  const { selected } = usePlaceSearch()

  return (
    <Map
      // `default*` and not `center`/`zoom`: the controlled props would fight
      // the user, snapping the viewport back on every pan. Recentring is an
      // imperative nudge instead — see RecentreOnSelection.
      defaultCenter={DEFAULT_CENTRE}
      defaultZoom={DEFAULT_ZOOM}
      // AdvancedMarker needs a vector map, which means a map id. DEMO_MAP_ID is
      // Google's published id for exactly this: it works without a Cloud
      // console map style, and it is the thing to replace when the map wants
      // real branding.
      mapId="DEMO_MAP_ID"
      gestureHandling="greedy"
      disableDefaultUI={false}
      className="h-full w-full"
    >
      <RecentreOnSelection />
      {selected && (
        <AdvancedMarker
          position={{ lat: selected.lat, lng: selected.lng }}
          title={selected.name}
        />
      )}
    </Map>
  )
}

/**
 * Pans to the selected place whenever it changes.
 *
 * A child of `<Map>` rather than an effect in `PlaceMap`, because `useMap()`
 * only finds the instance from inside the map's own context.
 */
function RecentreOnSelection() {
  const map = useMap()
  const { selected } = usePlaceSearch()

  useEffect(() => {
    if (!map || !selected) return
    map.panTo({ lat: selected.lat, lng: selected.lng })
    // Zooms in on the first pick, then leaves the user's zoom alone if they
    // have already zoomed further in than this.
    if ((map.getZoom() ?? 0) < SELECTED_ZOOM) map.setZoom(SELECTED_ZOOM)
  }, [map, selected])

  return null
}
