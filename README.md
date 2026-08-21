# mvp-react-java-springboot

A React + Java Spring Boot MVP. The whole development loop runs in Docker, with
**Microsoft SQL Server** as the database. All you need on your machine is Docker
— no JDK, no Gradle, no Node, no `sqlcmd`.

```bash
cp .env.example .env     # optional; every value has a default
make up                  # first run pulls images and downloads dependencies
```

| | |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:8080/api/notes |
| API Playground | http://localhost:5173/apps/api-playground |
| Place Finder | http://localhost:5173/apps/place-finder |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| CloudBeaver | `make db-ui` (prints URL + connection values) |

The first `make up` takes a few minutes. After that it's about 90 seconds to a
working API. Run `make` on its own to list every target.

**New here? [WALKTHROUGH.md](WALKTHROUGH.md) is the guided tour** — every
requirement, how to see it working, and the file to open for each.

## What it is

One feature built all the way through: a notes list in React that reads and
writes through Spring Boot into SQL Server, with Flyway managing the schema.

```
.
├── apps/
│   ├── api/                   Spring Boot 4.1 · Java 21 · Gradle · JPA · Flyway · springdoc
│   └── web/                   React 19 · Vite · TypeScript
├── infra/db/                  the one-shot script that creates the database
└── docs-postman/              the Postman collection
```

The database is named **`TESTDB`**; `MSSQL_DB` in `.env` is the only place you
change it. There is no root `package.json` — the `Makefile` is the task runner.

## The four things that will bite you

**SQL Server needs the database to exist before Flyway can run.** There is no
`POSTGRES_DB` equivalent, so a fresh volume gives Flyway `Cannot open database
"TESTDB"`. The `db-init` one-shot service creates it, and `api` waits for
`service_completed_successfully` — a healthy server is not the same as an
existing database.

**`encrypt=false` in the JDBC URL is required locally.** The 12.x driver
defaults to `encrypt=true` and the dev certificate is self-signed, so the
default fails with `PKIX path building failed`.

**Service names everywhere, except in the browser.** The API reaches SQL Server
at `db:1433`, but `VITE_API_URL` is `http://localhost:8080`, because that value
is handed to the browser, where `api` is not resolvable.

**Budget about 5GB of RAM.** SQL Server won't start below 2GB, and the API wants
3g. This is the main cost of choosing SQL Server over Postgres here.

## Contract between the two apps

Java and TypeScript share no source, so the API's OpenAPI document is the
contract:

```bash
make types    # /v3/api-docs -> apps/web/src/api-types.ts
```

Changing a Java record without regenerating gives you a type error instead of a
runtime surprise.

## Logs

`apps/api/logs/api.log` has the request/response pair for every call (masked
headers, body capped at 2 KB, status, duration); `activity.log` has one plain
sentence per action. Every response carries an `X-Request-Id` and every log line
starts with it, so one `grep` gives you a whole call.

## Common targets

```bash
make logs            # or api-logs / web-logs / db-logs
make api-file-logs   # the two files the API writes, on the host
make db-init-logs    # first stop if the API cannot reach the database
make test            # every suite: Vitest, JUnit unit, JUnit integration
make postman         # newman, against the running stack
make db-shell        # sqlcmd, no host install
make migrate-status  # Flyway history
make fresh           # nuke volumes, recreate the DB, replay from V1
```

Current state: 183 tests passing (120 Vitest, 63 JUnit), 17 Postman requests /
64 assertions, typecheck and build clean.

## Deliberately missing

No Redis, no worker, no auth, no CI config. Development connects as `sa`; a real
deployment would use a dedicated login and disable it. There is also no
production Dockerfile — `apps/api/Dockerfile` mounts source and runs Gradle,
which is right for development and wrong for shipping.
