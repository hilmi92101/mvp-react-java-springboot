import type { FavouritePlace } from '../types'
import { listFavourites, removeFavourite, saveFavourite } from './favourites-api'

/**
 * Same stubbed-`fetch` approach as `src/api.test.ts`. What is specific here is
 * the narrowing: the API's row carries columns the UI never renders (`id`,
 * `createdAt`), and `toFavourite` is the only thing keeping them out of Redux.
 */

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * An empty body has to be passed as `null`, not `''`: the Response constructor
 * rejects any body at all for a null-body status, and 204 is the one every
 * DELETE here returns.
 */
function respond(body: string, init: ResponseInit = {}) {
  fetchMock.mockResolvedValue(new Response(body === '' ? null : body, { status: 200, ...init }))
}

function urlOf(index = 0): string {
  return String(fetchMock.mock.calls[index][0])
}

function initOf(index = 0): RequestInit {
  return fetchMock.mock.calls[index][1] as RequestInit
}

const klcc: FavouritePlace = {
  placeId: 'p1',
  name: 'Petronas Twin Towers',
  formattedAddress: 'Kuala Lumpur City Centre',
  lat: 3.1578,
  lng: 101.7117,
}

/** What the API actually returns — the UI shape plus the columns it ignores. */
const row = { id: 42, createdAt: '2026-08-21T10:00:00Z', ...klcc }

describe('listFavourites', () => {
  it('GETs /api/places and narrows each row to what the UI renders', async () => {
    respond(JSON.stringify([row]))

    await expect(listFavourites()).resolves.toEqual([klcc])
    expect(urlOf()).toMatch(/\/api\/places$/)
    expect(initOf().method).toBeUndefined()
  })

  it('returns an empty list for an empty table', async () => {
    respond('[]')

    await expect(listFavourites()).resolves.toEqual([])
  })

  it('throws a readable error on a 500', async () => {
    respond('{}', { status: 500 })

    await expect(listFavourites()).rejects.toThrow('GET /places → 500')
  })
})

describe('saveFavourite', () => {
  it('POSTs the place and returns the narrowed row back', async () => {
    respond(JSON.stringify(row))

    await expect(saveFavourite(klcc)).resolves.toEqual(klcc)
    expect(urlOf()).toMatch(/\/api\/places$/)
    expect(initOf().method).toBe('POST')
    expect(JSON.parse(String(initOf().body))).toEqual(klcc)
  })

  // The endpoint is idempotent on placeId and answers with the existing row,
  // which is what lets the component star without checking first.
  it('is safe to call for a place that is already starred', async () => {
    respond(JSON.stringify(row))

    await expect(saveFavourite(klcc)).resolves.toEqual(klcc)
  })

  it('throws a readable error on a 400', async () => {
    respond('{"placeId":"must not be blank"}', { status: 400 })

    await expect(saveFavourite(klcc)).rejects.toThrow('POST /places → 400')
  })
})

describe('removeFavourite', () => {
  it('DELETEs by place id and resolves the 204 to undefined', async () => {
    respond('', { status: 204 })

    await expect(removeFavourite('p1')).resolves.toBeUndefined()
    expect(urlOf()).toMatch(/\/api\/places\/p1$/)
    expect(initOf().method).toBe('DELETE')
  })

  // Google's place ids are opaque and have contained slashes.
  it('encodes the place id into the path', async () => {
    respond('', { status: 204 })

    await removeFavourite('a/b c')

    expect(urlOf()).toMatch(/\/api\/places\/a%2Fb%20c$/)
  })

  it('throws a readable error on a 404', async () => {
    respond('', { status: 404 })

    await expect(removeFavourite('p1')).rejects.toThrow('DELETE /places/p1 → 404')
  })
})
