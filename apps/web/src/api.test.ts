import { api, call, playgroundPaths } from './api'

/**
 * `globalThis.fetch` is stubbed rather than a server being started: the point
 * of these tests is what the two helpers do with a *response*, and the
 * interesting responses (an HTML 502 from a proxy, a rejected promise) are
 * ones a real server would not produce on demand.
 *
 * The base URL is read at module load from `import.meta.env`, so nothing here
 * asserts the host — only the path, which is the part the app owns.
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

/** The URL of the nth call, as a string. */
function urlOf(index = 0): string {
  return String(fetchMock.mock.calls[index][0])
}

function initOf(index = 0): RequestInit {
  return fetchMock.mock.calls[index][1] as RequestInit
}

describe('call', () => {
  it('reports a 200 with its parsed body and request id', async () => {
    respond(JSON.stringify({ id: '1', title: 'Buy milk' }), {
      headers: { 'X-Request-Id': 'abc-123' },
    })

    const result = await call<{ id: string }>('/notes/1')

    expect(urlOf()).toMatch(/\/api\/notes\/1$/)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.requestId).toBe('abc-123')
    expect(result.body).toEqual({ id: '1', title: 'Buy milk' })
    expect(result.ms).toBeGreaterThanOrEqual(0)
  })

  // The playground has a card whose whole point is a 400, so a non-2xx has to
  // come back as data and not as a throw.
  it('returns a 400 as data, body included', async () => {
    respond(JSON.stringify({ title: 'must not be blank' }), { status: 400 })

    const result = await call('/notes', { method: 'POST', body: '{}' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ title: 'must not be blank' })
  })

  it('leaves an unparseable body as the raw text', async () => {
    respond('<html><body>502 Bad Gateway</body></html>', { status: 502 })

    const result = await call('/notes')

    expect(result.body).toBe('<html><body>502 Bad Gateway</body></html>')
  })

  it('gives an empty body back as an empty string, not a parse error', async () => {
    respond('', { status: 204 })

    const result = await call('/notes/1', { method: 'DELETE' })

    expect(result.ok).toBe(true)
    expect(result.status).toBe(204)
    expect(result.body).toBe('')
  })

  it('turns a network failure into status 0 with the message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await call('/notes')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    expect(result.requestId).toBeNull()
    expect(result.body).toEqual({ error: 'Failed to fetch' })
  })

  it('reports a missing X-Request-Id as null rather than throwing', async () => {
    respond('[]')

    expect((await call('/notes')).requestId).toBeNull()
  })

  it('sends JSON by default and lets the caller override the method', async () => {
    respond('{}')

    await call('/notes', { method: 'POST', body: '{"title":"x"}' })

    expect(initOf().method).toBe('POST')
    expect(initOf().headers).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('api', () => {
  it('lists notes', async () => {
    respond(JSON.stringify([{ id: '1' }]))

    await expect(api.list()).resolves.toEqual([{ id: '1' }])
    expect(urlOf()).toMatch(/\/api\/notes$/)
  })

  it('creates a note from a title alone', async () => {
    respond(JSON.stringify({ id: '1', title: 'Buy milk' }))

    await api.create('Buy milk')

    expect(initOf().method).toBe('POST')
    expect(initOf().body).toBe('{"title":"Buy milk"}')
  })

  it('patches only the done flag', async () => {
    respond(JSON.stringify({ id: '1', done: true }))

    await api.setDone('1', true)

    expect(urlOf()).toMatch(/\/api\/notes\/1$/)
    expect(initOf().method).toBe('PATCH')
    expect(initOf().body).toBe('{"done":true}')
  })

  // DELETE answers 204, and res.json() on an empty body throws a SyntaxError
  // that reads like a network fault. This is the test that pins the guard.
  it('resolves a 204 delete to undefined', async () => {
    respond('', { status: 204 })

    await expect(api.remove('1')).resolves.toBeUndefined()
  })

  it('throws a readable error naming the method, path and status', async () => {
    respond(JSON.stringify({ error: 'boom' }), { status: 500 })

    await expect(api.create('Buy milk')).rejects.toThrow('POST /notes → 500')
  })

  it('names GET when the caller set no method', async () => {
    respond('', { status: 404 })

    await expect(api.list()).rejects.toThrow('GET /notes → 404')
  })

  it('lets a network rejection through untouched', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(api.list()).rejects.toThrow('Failed to fetch')
  })
})

describe('playgroundPaths', () => {
  it('builds the paged and single-note paths', () => {
    expect(playgroundPaths.pagedNotes(2)).toBe('/notes?page=2')
    expect(playgroundPaths.oneNote('abc')).toBe('/notes/abc')
  })

  it('encodes anything user-typed', () => {
    expect(playgroundPaths.searchPlaces('kuala lumpur & co')).toBe(
      '/places/search?q=kuala%20lumpur%20%26%20co',
    )
    expect(playgroundPaths.placeDetails('a/b')).toBe('/places/details/a%2Fb')
  })
})
