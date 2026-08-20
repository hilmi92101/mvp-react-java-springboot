import type { components } from '@/api-types'

import type { FavouritePlace } from '../types'

/**
 * The `/api/places` half of the feature — the only part that talks to Spring
 * Boot rather than to Google.
 *
 * The request and response shapes are the generated ones, so a change to a Java
 * record shows up here as a type error after `make types` rather than as a
 * runtime surprise. Same contract `src/api.ts` uses for notes.
 */

type FavouritePlaceResponse = components['schemas']['FavouritePlaceResponse']
type SaveFavouritePlace = components['schemas']['SaveFavouritePlace']

// Injected by compose as a host URL, because this runs in the browser. The
// fallback keeps `npm run dev` outside Docker working. Duplicated from
// `src/api.ts` on purpose: promoting a shared client is the kind of thing the
// folder-structure doc says to do on the *second* consumer, and notes still
// needs its own `request` for other reasons.
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`)
  }
  // 204 has no body, and res.json() on an empty body throws a SyntaxError that
  // reads like a network fault. DELETE returns 204.
  return res.status === 204 ? (undefined as T) : res.json()
}

/** The API's row shape, narrowed to what the UI actually renders. */
function toFavourite(row: FavouritePlaceResponse): FavouritePlace {
  return {
    placeId: row.placeId,
    name: row.name,
    formattedAddress: row.formattedAddress,
    lat: row.lat,
    lng: row.lng,
  }
}

export async function listFavourites(): Promise<FavouritePlace[]> {
  const rows = await request<FavouritePlaceResponse[]>('/places')
  return rows.map(toFavourite)
}

/**
 * Stars a place. Safe to call for something already stored — the API is
 * idempotent on `placeId` and returns the existing row.
 */
export async function saveFavourite(place: FavouritePlace): Promise<FavouritePlace> {
  const row = await request<FavouritePlaceResponse>('/places', {
    method: 'POST',
    body: JSON.stringify(place satisfies SaveFavouritePlace),
  })
  return toFavourite(row)
}

/** Un-stars by Google's place id — the only id the browser ever holds. */
export function removeFavourite(placeId: string): Promise<void> {
  return request<void>(`/places/${encodeURIComponent(placeId)}`, { method: 'DELETE' })
}
