import { useCallback, useMemo, useState } from 'react'

import { call, playgroundPaths as paths } from '@/api'
import type { Note, PagedNotes, PlaceSearchResults } from '@/api'

import { useEndpoint, type Attempt } from './use-endpoint'

/** One entry in the list of things this page can do. */
type CardSpec = {
  id: string
  title: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'GET ×2' | 'POST + GET'
  path: string
  /** Why this card exists -- one sentence, no marketing. */
  blurb: string
  fire: () => Promise<Attempt>
}

const plain = (result: Awaited<ReturnType<typeof call>>): Attempt => ({ result })

/**
 * Every card on the page.
 *
 * A flat array and not a component per endpoint: the cards differ only in the
 * call they make and the sentence they carry, and thirteen near-identical
 * components would hide that.
 */
function useCards(): CardSpec[] {
  const [lastNoteId, setLastNoteId] = useState<string | null>(null)
  const [lastPlaceId, setLastPlaceId] = useState<string | null>(null)

  return useMemo<CardSpec[]>(() => [
    {
      id: 'list',
      title: 'List every note',
      method: 'GET',
      path: '/api/notes',
      blurb: 'The un-paged shape. Bare GET still returns a flat array, which is why the notes page needed no change.',
      fire: async () => plain(await call<Note[]>(paths.listNotes)),
    },
    {
      id: 'paged',
      title: 'One page of notes',
      method: 'GET',
      path: '/api/notes?page=0',
      blurb: 'Ten records per page. `size` is clamped server-side, so asking for 500 still gets you ten.',
      fire: async () => {
        const result = await call<PagedNotes>(paths.pagedNotes(0))
        const body = result.body as PagedNotes
        return {
          result,
          note: result.ok
            ? `${body.content.length} of ${body.totalElements} notes, page ${body.page + 1} of ${Math.max(body.totalPages, 1)}`
            : undefined,
        }
      },
    },
    {
      id: 'page-2',
      title: 'The second page',
      method: 'GET',
      path: '/api/notes?page=1',
      blurb: 'Same endpoint, next page. Empty until there are more than ten notes.',
      fire: async () => plain(await call<PagedNotes>(paths.pagedNotes(1))),
    },
    {
      id: 'create',
      title: 'Create a note',
      method: 'POST',
      path: '/api/notes',
      blurb: 'Writes a row and one plain sentence into activity.log. The id is remembered for the two cards below.',
      fire: async () => {
        const result = await call<Note>(paths.createNote, {
          method: 'POST',
          // Timestamped so repeated clicks are distinguishable in the log file.
          body: JSON.stringify({ title: `from the playground, ${new Date().toLocaleTimeString()}` }),
        })
        if (result.ok) {
          setLastNoteId((result.body as Note).id)
        }
        return { result, note: result.ok ? 'Id remembered for "Read one note" and "Delete".' : undefined }
      },
    },
    {
      id: 'get-one',
      title: 'Read one note',
      method: 'GET',
      path: lastNoteId ? `/api/notes/${lastNoteId}` : '/api/notes/{id}',
      blurb: lastNoteId
        ? 'The note the Create card just made.'
        : 'Create a note first — this card needs an id to read.',
      fire: async () =>
        lastNoteId
          ? plain(await call<Note>(paths.oneNote(lastNoteId)))
          : plain(await call<Note>(paths.oneNote('00000000-0000-0000-0000-000000000000'))),
    },
    {
      id: 'not-found',
      title: 'A 404, on purpose',
      method: 'GET',
      path: '/api/notes/00000000-0000-0000-0000-000000000000',
      blurb: 'An unknown id is a 404 and not an empty 200. The log line shows the status the caller actually got.',
      fire: async () => plain(await call(paths.oneNote('00000000-0000-0000-0000-000000000000'))),
    },
    {
      id: 'patch',
      title: 'Tick a note off',
      method: 'PATCH',
      path: lastNoteId ? `/api/notes/${lastNoteId}` : '/api/notes/{id}',
      blurb: 'PATCH, not PUT — the checkbox sends `done` alone and has no reason to know the title.',
      fire: async () => {
        if (lastNoteId === null) {
          return plain(await call(paths.oneNote('00000000-0000-0000-0000-000000000000'), {
            method: 'PATCH',
            body: JSON.stringify({ done: true }),
          }))
        }
        return plain(await call<Note>(paths.oneNote(lastNoteId), {
          method: 'PATCH',
          body: JSON.stringify({ done: true }),
        }))
      },
    },
    {
      id: 'delete',
      title: 'Delete that note',
      method: 'DELETE',
      path: lastNoteId ? `/api/notes/${lastNoteId}` : '/api/notes/{id}',
      blurb: 'Answers 204 with no body, and 404 if it was already gone.',
      fire: async () => {
        const id = lastNoteId ?? '00000000-0000-0000-0000-000000000000'
        const result = await call<void>(paths.oneNote(id), { method: 'DELETE' })
        if (result.ok) {
          setLastNoteId(null)
        }
        return { result, note: result.ok ? 'Gone. The id is forgotten.' : undefined }
      },
    },
    {
      id: 'rollback',
      title: 'Rollback: a rejected write changes nothing',
      method: 'POST + GET',
      path: '/api/notes  →  /api/notes',
      blurb:
        'The only card that proves something rather than demonstrating it. It POSTs a blank title, takes the 400, then re-counts the notes — the transaction boundary in NoteServiceImpl is what makes the count hold still.',
      fire: async () => {
        const before = await call<Note[]>(paths.listNotes)
        const beforeCount = Array.isArray(before.body) ? before.body.length : -1

        const rejected = await call(paths.createNote, {
          method: 'POST',
          body: JSON.stringify({ title: '   ' }),
        })

        const after = await call<Note[]>(paths.listNotes)
        const afterCount = Array.isArray(after.body) ? after.body.length : -1

        return {
          result: rejected,
          note:
            beforeCount === afterCount
              ? `Rejected with ${rejected.status}. The note count held at ${afterCount}.`
              : `Rejected with ${rejected.status}, but the count moved ${beforeCount} → ${afterCount}. That is a bug.`,
        }
      },
    },
    {
      id: 'rates',
      title: 'Third party: live FX rates',
      method: 'GET',
      path: '/api/external/rates?base=MYR',
      blurb:
        'The server calls api.frankfurter.app and re-shapes the answer. No API key is involved, which is why this is the card that always works.',
      fire: async () => {
        const result = await call(paths.rates('MYR'))
        const body = result.body as { rates?: Record<string, number>; upstreamMs?: number }
        return {
          result,
          note: result.ok
            ? `${Object.keys(body.rates ?? {}).length} currencies, upstream took ${body.upstreamMs}ms`
            : undefined,
        }
      },
    },
    {
      id: 'places-search',
      title: 'Third party: Google Places, key held server-side',
      method: 'GET',
      path: '/api/places/search?q=kuala lumpur',
      blurb:
        'The same search the Place Finder page does in the browser, moved behind the API. GOOGLE_PLACES_API_KEY has no VITE_ prefix, so it cannot reach this bundle.',
      fire: async () => {
        const result = await call<PlaceSearchResults>(paths.searchPlaces('kuala lumpur'))
        const body = result.body as PlaceSearchResults
        if (result.ok && body.results.length > 0) {
          setLastPlaceId(body.results[0].placeId)
        }
        return {
          result,
          note: result.ok
            ? `${body.results.length} results in ${body.upstreamMs}ms. First place id remembered.`
            : result.status === 503
              ? 'GOOGLE_PLACES_API_KEY is not set on the API container.'
              : undefined,
        }
      },
    },
    {
      id: 'places-details',
      title: 'One place, by Google id',
      method: 'GET',
      path: lastPlaceId ? `/api/places/details/${lastPlaceId}` : '/api/places/details/{placeId}',
      blurb: lastPlaceId
        ? 'The first result from the search above.'
        : 'Run the search card first — this one needs a place id.',
      fire: async () =>
        plain(await call(paths.placeDetails(lastPlaceId ?? 'ChIJ0-cIvSo2zDERmWzYQPUfLiM'))),
    },
    {
      id: 'starred',
      title: 'Starred places',
      method: 'GET',
      path: '/api/places',
      blurb: 'The database side of the same feature. Starring happens on the Place Finder page.',
      fire: async () => plain(await call(`/places`)),
    },
  ], [lastNoteId, lastPlaceId])
}

export function EndpointCards() {
  const cards = useCards()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <EndpointCard key={card.id} card={card} />
      ))}
    </div>
  )
}

function EndpointCard({ card }: { card: CardSpec }) {
  // Wrapped so the identity is stable across the parent's re-render, which is
  // what keeps `useEndpoint`'s callback from being rebuilt on every keystroke
  // elsewhere on the page.
  const fire = useCallback(() => card.fire(), [card])
  const { running, attempt, run } = useEndpoint(fire)

  return (
    <section className="border-border flex flex-col rounded-xl border p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{card.title}</h2>
          <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
            <span className="font-semibold">{card.method}</span> {card.path}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="border-border shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </header>

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{card.blurb}</p>

      {attempt !== null && <Outcome attempt={attempt} />}
    </section>
  )
}

function Outcome({ attempt }: { attempt: Attempt }) {
  const { result, note } = attempt

  return (
    <div className="mt-4 flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge ok={result.ok} status={result.status} />
        <span className="text-muted-foreground">{result.ms}ms</span>
        {/*
          The whole reason this page is worth having: copy this id, grep it in
          apps/api/logs/api.log, and the REQ/RES pair for exactly this click is
          there.
        */}
        {result.requestId !== null && (
          <code
            className="text-muted-foreground rounded bg-black/5 px-1.5 py-0.5 break-all dark:bg-white/10"
            title="X-Request-Id — grep this in apps/api/logs/api.log"
          >
            {result.requestId}
          </code>
        )}
      </div>

      {note !== undefined && <p className="text-xs font-medium">{note}</p>}

      <pre className="max-h-56 overflow-auto rounded-md bg-black/5 p-3 font-mono text-[11px] leading-relaxed dark:bg-white/10">
        {typeof result.body === 'string' && result.body === ''
          ? '(no body)'
          : JSON.stringify(result.body, null, 2)}
      </pre>
    </div>
  )
}

function StatusBadge({ ok, status }: { ok: boolean; status: number }) {
  return (
    <span
      className={
        'rounded px-1.5 py-0.5 font-mono font-semibold ' +
        (ok
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-500/15 text-red-700 dark:text-red-400')
      }
    >
      {/* 0 is the browser's "no response at all" -- CORS, DNS, API down. */}
      {status === 0 ? 'no response' : status}
    </span>
  )
}
