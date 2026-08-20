// Injected by compose as a host URL, because this runs in the browser — see
// the VITE_API_URL comment in docker-compose.yml. The fallback keeps `npm run
// dev` outside Docker working.
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

// Derived from the API's own OpenAPI document, not hand-written. `make types`
// regenerates api-types.ts; changing a Java record and forgetting to run it
// shows up as a type error here rather than as a runtime surprise. This is the
// only code the two apps share — Java and TypeScript have no source-level
// overlap, so a generated contract is the substitute.
import type { components } from './api-types'

export type Note = components['schemas']['NoteResponse']
type CreateNote = components['schemas']['CreateNote']
type UpdateNote = components['schemas']['UpdateNote']

export type PagedNotes = components['schemas']['PagedNotes']
export type PlaceSearchResults = components['schemas']['PlaceSearchResults']
export type PlaceDetail = components['schemas']['PlaceDetail']
export type Rates = components['schemas']['RatesResponse']

/**
 * One call, described well enough for the playground page to render it.
 *
 * The plain `api` helpers below throw away everything but the body, which is
 * all the notes page ever wanted. The playground's whole job is to show the
 * things they discard: the status, how long it took, and the `X-Request-Id`
 * that finds the matching line in `apps/api/logs/api.log`.
 */
export type CallResult<T> = {
  ok: boolean
  status: number
  ms: number
  /** Echoed by the API's RequestLoggingFilter. `null` only if a proxy ate it. */
  requestId: string | null
  /** Parsed body on success, the error body (or message) on failure. */
  body: T | unknown
}

/**
 * Fetch that never throws, and always reports.
 *
 * Not built on `request()` below: that one throws on a non-2xx, and a thrown
 * error has already lost the status, the duration and the header. The
 * playground has a card whose *point* is a 400, so a helper that treats
 * non-2xx as unrepresentable is the wrong tool.
 */
export async function call<T>(path: string, init?: RequestInit): Promise<CallResult<T>> {
  const startedAt = performance.now()
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    const ms = Math.round(performance.now() - startedAt)
    // Read as text first: an error response can be empty (204) or HTML (a
    // proxy's 502 page), and res.json() on either throws a SyntaxError that
    // reads like a network fault.
    const text = await res.text()
    let body: unknown = text
    if (text !== '') {
      try {
        body = JSON.parse(text)
      } catch {
        // Leave it as text -- showing the raw body beats showing a parse error.
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      ms,
      requestId: res.headers.get('X-Request-Id'),
      body: body as T,
    }
  } catch (error) {
    // A network-level failure: CORS, DNS, the API not running. Status 0 is the
    // browser's own convention for "no response happened at all".
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - startedAt),
      requestId: null,
      body: { error: error instanceof Error ? error.message : String(error) },
    }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`)
  }
  // 204 has no body, and res.json() on an empty body throws a SyntaxError
  // that reads like a network fault. DELETE returns 204.
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  list: () => request<Note[]>('/notes'),
  create: (title: string) =>
    request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify({ title } satisfies CreateNote),
    }),
  setDone: (id: string, done: boolean) =>
    request<Note>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done } satisfies UpdateNote),
    }),
  remove: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
}

/**
 * The endpoints the playground page exercises, as URL builders.
 *
 * Deliberately paths and not functions that fetch: each card shows the request
 * it is about to send, so the string has to exist before the call does.
 */
export const playgroundPaths = {
  listNotes: '/notes',
  pagedNotes: (page: number) => `/notes?page=${page}`,
  oneNote: (id: string) => `/notes/${id}`,
  createNote: '/notes',
  rates: (base: string) => `/external/rates?base=${base}`,
  searchPlaces: (query: string) => `/places/search?q=${encodeURIComponent(query)}`,
  placeDetails: (placeId: string) => `/places/details/${encodeURIComponent(placeId)}`,
} as const
