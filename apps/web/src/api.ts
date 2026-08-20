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
