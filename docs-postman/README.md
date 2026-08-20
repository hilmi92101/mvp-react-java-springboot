# Postman collection — MVP API

Every endpoint the Spring Boot API serves, with assertions. 17 requests, 64
assertions, three folders.

This directory is called `docs-postman/` and not `docs/postman/` because
[`.gitignore`](../.gitignore) ignores a directory named exactly `docs` — the
collection has to be tracked to be worth sharing, so it lives beside that
directory rather than inside it.

## Files

| File | What it is |
|---|---|
| `mvp-api.postman_collection.json` | The requests and their tests |
| `mvp-api.postman_environment.json` | One variable: `baseUrl` |

## Run it from the terminal

```console
make postman
```

That is the whole thing. It runs `newman` inside the `web` container, so no
Node install is needed on the host — the same property every other target in
the [Makefile](../Makefile) protects.

The stack has to be up first (`make up`). Newman against a stack it just
started would be measuring a cold JVM, which is why the target does not start
one.

## Run it in the Postman app

1. **Import** → both JSON files.
2. Pick **MVP API — local Docker** in the environment dropdown, top right.
3. Run the folders **top to bottom**.

`baseUrl` is `http://localhost:8080` in the app and `http://api:8080` under
`make postman`. Both are correct: the app is on the host, newman is inside the
compose network.

## Run order matters

| Folder | Why |
|---|---|
| **Notes** | *Create a note* stashes `noteId`; four later requests use it |
| **Third party (keyless)** | Independent — run it alone if you like |
| **Google Places** | *Search* stashes `placeId`; *One place by id* uses it |

Running a single request out of order fails on an unset collection variable.
That is deliberate: a green run should mean the whole flow worked, not that
each request survived in isolation.

The Notes folder deletes what it created, so the collection is re-runnable and
leaves the database as it found it.

## What the assertions actually check

Two run against **every** response, from a collection-level script:

- an `X-Request-Id` header is present — the contract between this collection
  and `apps/api/logs/api.log`
- the response arrived within 20 seconds — deliberately loose, because two
  folders make a real outbound call and the API's own outbound read timeout is
  10s; a tighter bound fails on someone else's slow server rather than on
  anything in this repo

The ones worth knowing about individually:

- **`GET /api/notes` is a flat array.** Pagination is conditional on `?page=`,
  and this is the assertion that fails if someone makes it unconditional —
  which would break the notes page without touching it.
- **Page size is 10 even when the client asks for 500.** `size` is clamped
  server-side; ten per page is the requirement, not a default.
- **The rollback pair.** *Rejected write* counts the notes in a pre-request
  script, POSTs a blank title, and takes the 400. *Rollback held* re-counts and
  asserts the number did not move. Counting before rather than after is the
  point — two counts taken after the write would pass no matter what it did.
- **The third-party responses are our shape, not theirs.** `upstreamMs` and
  `source` are fields we add; Frankfurter sends neither, and Google sends
  `displayName.text` where we send `name`. If those assertions fail, someone
  has started proxying an upstream body straight through and the API's contract
  now moves when theirs does.
- **A malformed Google place id is a 400, not a 502.** Passing an upstream 4xx
  through as a gateway error sends whoever is debugging to the wrong machine.

## When Google Places fails

| Status | Meaning | Fix |
|---|---|---|
| 503 | `GOOGLE_PLACES_API_KEY` is not set on the API container | Set it in `.env`, then `docker compose up -d api` |
| 502 | Google rejected the key | Usually an HTTP-referrer restriction — a server sends no referrer. Use a second key restricted by IP, or unrestricted for local development |

The other two folders do not depend on a credential, so a Places failure does
not take the run down with it — it fails four assertions and the other sixty
still tell you something.

## Tracing a request into the log

Every response carries the id, and so does every line the server wrote:

```console
grep 3feec905-cb22-4489-af9d-3a3d0fa036a5 apps/api/logs/api.log
```

`make api-file-logs` tails both files live while a run is in flight.

## Related

- [API Playground](../docs/features/api-playground.md) — the same endpoints as a
  clickable page at `/apps/api-playground`
- [`@Validated` returns 500](../docs/troubleshooting/validated-on-a-controller-returns-500.md)
  — a bug this collection caught
