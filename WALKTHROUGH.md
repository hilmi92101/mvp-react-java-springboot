# Walkthrough

A step-by-step tour of this project: bring it up, then see each requirement
working, with the file to open for each.

Repo: <https://github.com/hilmi92101/mvp-react-java-springboot>

Both assessment parts live in this one repo:

- **Part 1 — Java / Spring Boot:** APIs, request/response file logging, MSSQL `TESTDB`, `@Transactional`, pagination at 10 per page, a nested third-party call.
- **Part 2 — ReactJS:** Google Place Autocomplete with a map, Redux storing every search, one Redux middleware, a styling library, and the optional "favourite a place" path through Spring Boot into the database.

The host needs **Docker only**. No JDK, no Gradle, no Node, no `sqlcmd`.

## Contents

- [Step 0 — Prerequisites](#step-0--prerequisites)
- [Step 1 — Clone and start](#step-1--clone-and-start)
- [Step 2 — Confirm it is up](#step-2--confirm-it-is-up)
- [Step 3 — Java: pagination, 10 per page](#step-3--java-pagination-10-per-page)
- [Step 4 — Java: request & response logged to a file](#step-4--java-request--response-logged-to-a-file)
- [Step 5 — Java: nested third-party call](#step-5--java-nested-third-party-call)
- [Step 6 — Java: `@Transactional` and rollback](#step-6--java-transactional-and-rollback)
- [Step 7 — Java: the database (`TESTDB`)](#step-7--java-the-database-testdb)
- [Step 8 — Java: run the Postman collection](#step-8--java-run-the-postman-collection)
- [Step 9 — React: add a Google Maps key](#step-9--react-add-a-google-maps-key)
- [Step 10 — React: autocomplete, map, and search history](#step-10--react-autocomplete-map-and-search-history)
- [Step 11 — React: favourite a place, end to end](#step-11--react-favourite-a-place-end-to-end)
- [Step 12 — Run the test suites](#step-12--run-the-test-suites)
- [Step 13 — Read the structure](#step-13--read-the-structure)
- [Requirement Map](#requirement-map)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Notes, Deviations and Known Gaps](#notes-deviations-and-known-gaps)
- [Troubleshooting](#troubleshooting)

---

## Step 0 — Prerequisites

- **Docker** with Compose v2 (`docker compose version`).
- **~5 GB free RAM.** SQL Server refuses to start below ~2 GB; the API is capped at 3 GB.
- Free ports: `5173`, `8080`, `1433`, `8978`. All four are configurable — see [Environment Variables](#environment-variables).
- Optional: `make` (every target is a plain `docker compose` command if you prefer to read them in the [Makefile](Makefile)).
- Optional, for Step 9 onward: a **Google Maps / Places API key**.

## Step 1 — Clone and start

```bash
git clone https://github.com/hilmi92101/mvp-react-java-springboot.git
cd mvp-react-java-springboot
cp .env.example .env
make up
```

`make` on its own lists every target.

**The first `make up` takes a few minutes** — Gradle resolves the dependency graph, Vite installs,
and SQL Server initialises a fresh data directory. After that, roughly 90 seconds from `make up`
to the API answering. If you `curl` too early you get a connection refused; that is startup, not a fault.

Watch it come up:

```bash
make logs          # every service
make api-logs      # just Spring Boot
```

## Step 2 — Confirm it is up

| | |
|---|---|
| Web | <http://localhost:5173> |
| API | <http://localhost:8080/api/notes> |
| Swagger UI | <http://localhost:8080/swagger-ui.html> |
| API Playground | <http://localhost:5173/apps/api-playground> |
| Place Finder | <http://localhost:5173/apps/place-finder> |

```bash
curl -s http://localhost:8080/api/notes | head -c 300
```

A JSON array means the API, JPA, Flyway and SQL Server are all working.

The **API Playground** page at `/apps/api-playground` is a browser client for every endpoint below,
if you would rather click than curl.

## Step 3 — Java: pagination, 10 per page

```bash
curl -s "http://localhost:8080/api/notes?page=0"
curl -s "http://localhost:8080/api/notes?page=1"
```

Page size is **fixed at 10** because the brief fixes it — it is not a client option:

```bash
curl -s "http://localhost:8080/api/notes?size=50" | grep -o '"size":[0-9]*'   # "size":10
```

One path serves two shapes, chosen by whether `?page=` is present: bare `GET /api/notes`
returns a flat array (what the notes UI uses), and `?page=` returns the paged envelope.
The reasoning is written above the method.

- Endpoint: [`NoteController.java`](apps/api/src/main/java/com/mvp/api/note/NoteController.java)
- `PAGE_SIZE = 10`: [`NoteServiceImpl.java`](apps/api/src/main/java/com/mvp/api/note/NoteServiceImpl.java)
- Envelope: [`PagedResponse.java`](apps/api/src/main/java/com/mvp/api/common/PagedResponse.java)

## Step 4 — Java: request & response logged to a file

Every request passes one servlet filter, and the output goes to **files**, not only the console.

```bash
make api-file-logs        # tails both log files
```

In another terminal, make any call and watch the pair appear:

```bash
curl -s "http://localhost:8080/api/notes?page=0" > /dev/null
```

Two files, inside the API container and on disk at `apps/api/logs/`:

| File | Contents |
|---|---|
| `api.log` | the `IN` line (method, path, body) and the `OUT` line (status, body, duration in ms) |
| `activity.log` | one human-readable line per call |

```bash
tail -n 20 apps/api/logs/api.log
```

A correlation id ties each `IN` to its `OUT`. API keys and secrets are masked before anything is written —
check with a call that carries one (Step 10) and confirm the key never appears in the file.
Both files roll over daily to `api.<date>.<n>.log.gz`, so if you look the next morning, yesterday's
calls are in the archive.

- [`RequestLoggingFilter.java`](apps/api/src/main/java/com/mvp/api/logging/RequestLoggingFilter.java) — the filter
- [`CorrelationId.java`](apps/api/src/main/java/com/mvp/api/logging/CorrelationId.java) — request↔response id
- [`LogMasker.java`](apps/api/src/main/java/com/mvp/api/logging/LogMasker.java) — secret masking
- [`ActivityLog.java`](apps/api/src/main/java/com/mvp/api/logging/ActivityLog.java) — the activity line
- [`logback-spring.xml`](apps/api/src/main/resources/logback-spring.xml) — file appenders and rollover

## Step 5 — Java: nested third-party call

Flow: **client → our API → a third-party API**. There are two of these.

The first needs no key at all, so it is demoable immediately (Frankfurter FX):

```bash
curl -s "http://localhost:8080/api/external/rates?base=USD"
curl -s "http://localhost:8080/api/external/rates"          # defaults to MYR
```

The response reports which third party answered and how long the upstream round trip took.
Upstream failure is mapped to a clean `502` rather than leaking a stack trace, and the failure
is logged — you can see it in `api.log` from Step 4.

The second is the Google Places passthrough used by the React app (Step 10), with the key held
server-side: `GET /api/places/search?q=` and `GET /api/places/details/{placeId}`.

- [`ExternalServiceImpl.java`](apps/api/src/main/java/com/mvp/api/external/ExternalServiceImpl.java) — the outbound call
- [`ExternalClientConfig.java`](apps/api/src/main/java/com/mvp/api/external/ExternalClientConfig.java) — `RestClient` with timeouts
- [`PlaceSearchServiceImpl.java`](apps/api/src/main/java/com/mvp/api/place/PlaceSearchServiceImpl.java) — Google Places

## Step 6 — Java: `@Transactional` and rollback

`@Transactional` covers INSERT, UPDATE and GET. Reads are `readOnly = true` rather than omitted.

Watch a write get rejected and the row count stay put:

```bash
curl -s "http://localhost:8080/api/notes?page=0" | grep -o '"totalElements":[0-9]*'

# blank title -> 400, nothing is written
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/notes \
  -H 'Content-Type: application/json' -d '{"title":""}'

curl -s "http://localhost:8080/api/notes?page=0" | grep -o '"totalElements":[0-9]*'   # unchanged
```

The Postman collection asserts the same thing in two requests: *"Rejected write — a blank title"*
followed by *"Rollback held — count did not move"*.

- [`NoteService.java`](apps/api/src/main/java/com/mvp/api/note/NoteService.java) — the annotated boundary
- [`NoteServiceImpl.java`](apps/api/src/main/java/com/mvp/api/note/NoteServiceImpl.java)
- [`PlaceServiceImpl.java`](apps/api/src/main/java/com/mvp/api/place/PlaceServiceImpl.java) — the favourite save

## Step 7 — Java: the database (`TESTDB`)

**Microsoft SQL Server**, database name **`TESTDB`**, running as a container on your local machine.
See [Notes, Deviations and Known Gaps](#notes-deviations-and-known-gaps) for why it is a container
and how to point it at a host install instead.

The schema is owned by **Flyway**, never by Hibernate auto-DDL:

```bash
make migrate-status      # Flyway's applied-migration history
make db-shell            # sqlcmd inside the db container
make db-ui               # CloudBeaver — prints the URL and the values to paste
```

In `sqlcmd` or CloudBeaver:

```sql
SELECT name FROM sys.databases;
SELECT COUNT(*) FROM notes;
SELECT * FROM favourite_places;
```

- [`application.yml`](apps/api/src/main/resources/application.yml) — `jdbc:sqlserver://db:1433;databaseName=TESTDB`
- [`V1__create_notes.sql`](apps/api/src/main/resources/db/migration/V1__create_notes.sql)
- [`V2__create_favourite_places.sql`](apps/api/src/main/resources/db/migration/V2__create_favourite_places.sql)
- [`infra/db/init.sh`](infra/db/init.sh) — creates `TESTDB` on first boot

## Step 8 — Java: run the Postman collection

The collection is in [`docs-postman/`](docs-postman/) — **17 requests, 64 test assertions**.

Either import both files into Postman (select the environment, then **Run folder**), or run it headless:

```bash
make postman
```

or directly:

```bash
cd docs-postman
npx newman run mvp-api.postman_collection.json -e mvp-api.postman_environment.json
```

Expected: **0 failures.** The only variable is `baseUrl`, set to `http://localhost:8080` in the
environment file. Requests that hit Google Places need the key from Step 9; everything else,
including the third-party FX call, passes without one.

See [`docs-postman/README.md`](docs-postman/README.md) for the import steps.

## Step 9 — React: add a Google Maps key

The Place Finder page needs **two** Google keys, and they cannot be the same key if the browser
one is HTTP-referrer restricted — a server sends no referrer, and Google answers `REQUEST_DENIED`.

In `.env`:

```bash
VITE_GOOGLE_MAPS_API_KEY=   # browser key: Maps JavaScript API + Places API (New)
GOOGLE_PLACES_API_KEY=      # server key:  Places API (New), IP-restricted or unrestricted
```

Then:

```bash
make web-restart      # VITE_ vars are read at dev-server start
make api-restart
```

Both Google APIs must be enabled and the project needs a billing account linked, though normal
review usage stays inside the free monthly allowance. The `VITE_` variable is compiled into the
bundle, so that value **is** public by design — restrict the key rather than hiding it.
[`.env.example`](.env.example) documents both, and the restrictions to set.

**Without keys:** the page still loads, but suggestions never arrive. `GET /api/places/search`
answers `503` and says the key is missing, rather than failing silently.

## Step 10 — React: autocomplete, map, and search history

Open <http://localhost:5173/apps/place-finder>.

1. Type `kuala` — suggestions come from the Google Places API as you type.
2. Pick one — the map pans to it and a details card appears.
3. Search two or three more places.
4. **Every search stays listed.** The requirement is search *history*, not just the current result — that list is the Redux store.

The Redux wiring:

- Store and middleware: [`app/store.ts`](apps/web/src/app/store.ts) — **Redux Saga**, and only Saga. No second middleware.
- Saga: [`place-search-saga.ts`](apps/web/src/features/place-search/stores/place-search-saga.ts) — `searchRequested` → call the SDK → `searchSucceeded`.
- Slice: [`place-search-slice.ts`](apps/web/src/features/place-search/stores/place-search-slice.ts) — `results` plus `searchHistory`.
- Selectors: [`selectors.ts`](apps/web/src/features/place-search/stores/selectors.ts)
- Typed hooks: [`app/hooks.ts`](apps/web/src/app/hooks.ts)

Only plain records go into the store — no `google.maps.Place` instances, which would break
Redux's serializability check.

Styling is **Tailwind** ([`index.css`](apps/web/src/index.css), [`vite.config.ts`](apps/web/vite.config.ts)),
utility classes in JSX throughout.

## Step 11 — React: favourite a place, end to end

This is the optional requirement, and the one path that runs React → Spring Boot → MSSQL.

1. Pick a place in the Place Finder.
2. Click the **star** on the details card.
3. Confirm the row landed:

```bash
curl -s http://localhost:8080/api/places
```

or in `make db-ui` / `make db-shell`:

```sql
SELECT place_id, name, lat, lng FROM favourite_places;
```

Starring the same place twice is **idempotent** — it returns the existing row rather than erroring
or duplicating. Un-starring is `DELETE /api/places/{placeId}`.

- Browser side: [`favourites-api.ts`](apps/web/src/features/place-search/api/favourites-api.ts), [`place-details-card.tsx`](apps/web/src/features/place-search/components/place-details-card.tsx)
- Server side: [`PlaceController.java`](apps/api/src/main/java/com/mvp/api/place/PlaceController.java), [`PlaceServiceImpl.java`](apps/api/src/main/java/com/mvp/api/place/PlaceServiceImpl.java) (`@Transactional`), [`FavouritePlace.java`](apps/api/src/main/java/com/mvp/api/place/FavouritePlace.java)

## Step 12 — Run the test suites

Everything runs in the containers — nothing to install.

```bash
make test                   # all three suites
```

Or individually:

```bash
make web-test               # Vitest: 14 files, 120 tests
make api-test               # Spring Boot unit tests, no database
make api-integration-test   # database-backed tests against TESTDB
```

| Suite | Count | Covers |
|---|---|---|
| Web | 120 tests / 14 files | slice, selectors, saga, components, `api.ts`, `favourites-api.ts` |
| API unit | 13 tests | the logging filter, masking, the third-party client |
| API integration | 50 tests | Flyway schema, repositories, every controller against the real `TESTDB`, and the masked line actually reaching `api.log` |

Nothing is mocked on the API side — the controller tests hit the real database
(`grep -r MockitoBean apps/api/src/test` finds nothing).

## Step 13 — Read the structure

Both briefs grade structure, so the layout is the deliberate part.

**Backend — one package per feature.** Controllers never touch repositories:
`controller → service interface → impl → repository`.

```text
apps/api/src/main/java/com/mvp/api/
  ApiApplication.java     # @SpringBootApplication
  common/                 # shared page envelope
  config/                 # OpenAPI
  logging/                # cross-cutting: filter, correlation id, masking
  note/                   # feature: notes      (controller, service, impl, dtos, entity, repo)
  external/               # feature: FX passthrough
  place/                  # feature: places + favourites
```

**Frontend — feature folders; pages only compose.** Each feature owns its `api/`, `components/`,
`hooks/`, `stores/` and `types/`, and exports through its own `index.ts`. Pages import from
`@/features/x`, never deep paths.

```text
apps/web/src/
  app/                    # store, router, providers, typed hooks
  components/ui/          # shared presentational components
  config/env.ts           # env access in one place
  features/
    place-search/
    app-catalog/
  pages/                  # thin route shells
```

All components are functions; there are no class components. The logic lives in custom hooks —
[`use-place-search.ts`](apps/web/src/features/place-search/hooks/use-place-search.ts),
[`use-app-search.ts`](apps/web/src/features/app-catalog/hooks/use-app-search.ts),
[`use-endpoint.ts`](apps/web/src/pages/api-playground/use-endpoint.ts).

## Requirement Map

Every requirement, with the file to open. Java brief first, then ReactJS.

| Requirement | Where | Step |
|---|---|---|
| Spring Boot application | [`ApiApplication.java`](apps/api/src/main/java/com/mvp/api/ApiApplication.java) | [1](#step-1--clone-and-start) |
| Proper project structure | one package per feature under [`com/mvp/api/`](apps/api/src/main/java/com/mvp/api/) | [13](#step-13--read-the-structure) |
| APIs for a client | [`NoteController`](apps/api/src/main/java/com/mvp/api/note/NoteController.java), [`ExternalController`](apps/api/src/main/java/com/mvp/api/external/ExternalController.java), [`PlaceController`](apps/api/src/main/java/com/mvp/api/place/PlaceController.java), [`PlaceSearchController`](apps/api/src/main/java/com/mvp/api/place/PlaceSearchController.java) | [2](#step-2--confirm-it-is-up) |
| Postman collection provided | [`docs-postman/`](docs-postman/) — 17 requests, 64 assertions | [8](#step-8--java-run-the-postman-collection) |
| Request & response into a log **file** | [`RequestLoggingFilter.java`](apps/api/src/main/java/com/mvp/api/logging/RequestLoggingFilter.java) → `apps/api/logs/api.log` | [4](#step-4--java-request--response-logged-to-a-file) |
| Database, MSSQL, `TESTDB` | [`application.yml`](apps/api/src/main/resources/application.yml), [`init.sh`](infra/db/init.sh), Flyway migrations | [7](#step-7--java-the-database-testdb) |
| `@Transactional` on INSERT / UPDATE / GET | [`NoteService.java`](apps/api/src/main/java/com/mvp/api/note/NoteService.java), [`PlaceServiceImpl.java`](apps/api/src/main/java/com/mvp/api/place/PlaceServiceImpl.java) | [6](#step-6--java-transactional-and-rollback) |
| GET with pagination, 10 per page | [`NoteServiceImpl.java`](apps/api/src/main/java/com/mvp/api/note/NoteServiceImpl.java) — `PAGE_SIZE = 10` | [3](#step-3--java-pagination-10-per-page) |
| API nesting a third-party call | [`ExternalServiceImpl.java`](apps/api/src/main/java/com/mvp/api/external/ExternalServiceImpl.java), [`PlaceSearchServiceImpl.java`](apps/api/src/main/java/com/mvp/api/place/PlaceSearchServiceImpl.java) | [5](#step-5--java-nested-third-party-call) |
| Autocomplete from the Google API | [`place-autocomplete-input.tsx`](apps/web/src/features/place-search/components/place-autocomplete-input.tsx), [`places-sdk.ts`](apps/web/src/features/place-search/api/places-sdk.ts) | [10](#step-10--react-autocomplete-map-and-search-history) |
| Map showing the place | [`place-map.tsx`](apps/web/src/features/place-search/components/place-map.tsx) | [10](#step-10--react-autocomplete-map-and-search-history) |
| Redux storing **all** searches | [`place-search-slice.ts`](apps/web/src/features/place-search/stores/place-search-slice.ts), [`search-history-list.tsx`](apps/web/src/features/place-search/components/search-history-list.tsx) | [10](#step-10--react-autocomplete-map-and-search-history) |
| One Redux middleware — Saga | [`store.ts`](apps/web/src/app/store.ts), [`place-search-saga.ts`](apps/web/src/features/place-search/stores/place-search-saga.ts) | [10](#step-10--react-autocomplete-map-and-search-history) |
| Styling library — Tailwind | [`index.css`](apps/web/src/index.css), [`vite.config.ts`](apps/web/vite.config.ts) | [10](#step-10--react-autocomplete-map-and-search-history) |
| Scalable code structure | [`apps/web/src/features/`](apps/web/src/features/) — pages only compose | [13](#step-13--read-the-structure) |
| ES6+, hooks, functional components | three custom hooks; no class components | [13](#step-13--read-the-structure) |
| *Optional* — favourite via Spring Boot + DB | React → [`PlaceController`](apps/api/src/main/java/com/mvp/api/place/PlaceController.java) → `TESTDB.favourite_places` | [11](#step-11--react-favourite-a-place-end-to-end) |

## API Reference

Interactive at <http://localhost:8080/swagger-ui.html>. No authentication — see
[Notes, Deviations and Known Gaps](#notes-deviations-and-known-gaps).

### `GET /api/notes`

No `?page=` — a flat array of notes.

### `GET /api/notes?page=0`

`200`:

```json
{
  "content": [
    { "id": "0f5e…", "title": "First note", "done": false, "createdAt": "2026-08-21T02:14:07Z" }
  ],
  "page": 0,
  "size": 10,
  "totalPages": 3,
  "totalElements": 27,
  "first": true,
  "last": false
}
```

`page` is zero-based. `size` is always `10`; `?size=` is ignored.

### `POST /api/notes`

```json
{ "title": "Review the submission" }
```

`201` returns the created note. `title` is required, max 200 chars.

### `PATCH /api/notes/{id}`

Partial body — the checkbox sends `done` alone:

```json
{ "done": true }
```

### `DELETE /api/notes/{id}`

`204`.

### `GET /api/external/rates?base=USD`

Nested third-party call. `base` defaults to `MYR`.

`200`:

```json
{
  "base": "USD",
  "date": "2026-08-21",
  "rates": { "EUR": 0.92, "MYR": 4.43 },
  "upstreamMs": 214,
  "source": "frankfurter.app"
}
```

Rates are decimals, not floats — money must not round-trip as `4.7299999999999995`.

### `GET /api/places/search?q=kuala`

Nested third-party call to Google Places, key held server-side. `q` is required, max 200 chars.

### `GET /api/places/details/{placeId}`

Details for one place id.

### `GET /api/places`

Every saved favourite, newest first.

### `POST /api/places`

```json
{
  "placeId": "ChIJ5-rvAcpJzDERfSgcL2ZOMB0",
  "name": "Kuala Lumpur",
  "formattedAddress": "Kuala Lumpur, Federal Territory of Kuala Lumpur, Malaysia",
  "lat": 3.139,
  "lng": 101.6869
}
```

`201` returns the saved row with its `id` and `createdAt`. Idempotent on `placeId` —
starring the same place twice returns the existing row.

### `DELETE /api/places/{placeId}`

`204`. Un-stars by Google place id, not by our row id.

### Error codes

| Code | When |
|---|---|
| `400` | validation failure — blank `title`, missing `lat`/`lng`, out-of-range coordinates, malformed place id |
| `404` | no note with that id; no such Google place |
| `502` | a third party was reachable but did not answer usefully — logged, never leaked as a stack trace |
| `503` | `GOOGLE_PLACES_API_KEY` is not set; the response says so explicitly |

`lat` and `lng` are boxed and required rather than primitives — a missing field would otherwise
bind to `0.0`, which is a real location in the Gulf of Guinea.

## Environment Variables

`cp .env.example .env` is enough to boot: **every value has a default except the two Google keys**.
[`.env.example`](.env.example) documents each one and why it exists.

| Var | Side | Required | Notes |
|---|---|---|---|
| `WEB_PORT` | host | no | `5173` |
| `API_PORT` | host | no | `8080` |
| `DB_PORT` | host | no | `1433` |
| `DBUI_PORT` | host | no | `8978` — CloudBeaver |
| `MSSQL_SA_PASSWORD` | db | no | must satisfy SQL Server's policy: 8+ chars, three of upper/lower/digit/symbol |
| `MSSQL_DB` | db | no | `TESTDB` |
| `WEB_ORIGIN` | api | no | CORS origin for the dev server |
| `VITE_API_URL` | web | no | `http://localhost:8080` |
| `VITE_GOOGLE_MAPS_API_KEY` | web | for Step 10 | browser key; compiled into the bundle, so restrict it |
| `GOOGLE_PLACES_API_KEY` | api | for Step 10 | server key; no `VITE_` prefix, so it never reaches the browser |
| `API_MEM_LIMIT` | api | no | `3g`, paired with `-XX:MaxRAMPercentage=75` |
| `DB_MEM_LIMIT` | db | no | `2g` — a floor, not a tuning knob |

## Notes, Deviations and Known Gaps

Stated up front rather than left to be found.

- **MSSQL runs as a container, not a host install.** The brief says "local machine DB". This is SQL Server on your local machine, with the exact database name `TESTDB` and a Flyway-owned schema — but in Docker, which is what keeps the whole stack to one command and no host JDK. To use a host install instead, point the datasource at `localhost:1433` in `.env`; nothing else changes.
- **`@Transactional` on GET is unusual** but the brief asks for it, so reads are `readOnly = true` rather than skipped.
- **Page size is hardcoded at 10** because the brief fixes it. `?size=` is deliberately ignored.
- **No authentication on any endpoint.** Neither brief asks for it, and adding it would put a login in front of everything being graded.
- **No HOC or render-props example, by choice.** The optional requirement asks for *one of* higher-order components, custom hooks, or render props. Custom hooks are used, in three places. HOCs and render props are the pre-hooks workarounds for the same problem; adding one now would be indirection with no purpose, and would work against the "scalable structure" requirement.
- **`place-map.tsx` has no unit test.** Its only logic is `panTo`/`setZoom` on a map instance that exists solely inside the Google `<APIProvider>`; testing it would mean asserting against a mock of Google's SDK. Every other frontend module is covered.
- **Log archives are not committed.** `apps/api/logs/*.log.gz` is gitignored — you generate them by running the stack.
- **Two Google keys, not one.** Explained in [Step 9](#step-9--react-add-a-google-maps-key); a single referrer-restricted key cannot serve both the browser and the server.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `connection refused` on `:8080` right after `make up` | Still starting. Allow ~90 seconds; `make api-logs` to watch. |
| Port already allocated | Change `WEB_PORT` / `API_PORT` / `DB_PORT` / `DBUI_PORT` in `.env`, then `make down && make up`. |
| The `db` container exits with a password-policy error | `MSSQL_SA_PASSWORD` is too weak. SQL Server enforces this at startup, so it looks like a crash. |
| The `db` container dies silently | Not enough RAM. SQL Server needs ~2 GB; the stack wants ~5 GB available. |
| Place Finder shows no suggestions | Google keys missing or restricted. See [Step 9](#step-9--react-add-a-google-maps-key). |
| `/api/places/search` returns `503` | `GOOGLE_PLACES_API_KEY` is empty. |
| Google returns `REQUEST_DENIED` for the server call | You reused the referrer-restricted browser key. Use a separate IP-restricted key. |
| Flyway checksum mismatch | A migration file was edited after it was applied. `make migrate-repair`, or `make fresh` for a clean database. |
| Changed a `VITE_` variable, nothing happened | `make web-restart` — they are read when the dev server starts. |
| Want to start completely clean | `make fresh` — nukes volumes and rebuilds. |
