# mvp-react-java-springboot

A React + Java Spring Boot MVP where the whole development loop runs in Docker,
backed by **Microsoft SQL Server**. The host needs Docker and nothing else — no
JDK, no Gradle, no Node, no `sqlcmd`.

```bash
cp .env.example .env     # optional; every value has a default
make up                  # first run pulls images and resolves dependencies
```

| | |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:8080/api/notes |
| API Playground | http://localhost:5173/apps/api-playground |
| Place Finder | http://localhost:5173/apps/place-finder |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| CloudBeaver | `make db-ui` (prints URL + connection values) |

`make` on its own lists every target.

The first `make up` takes a few minutes — Gradle resolves the dependency graph,
Vite installs, and SQL Server initialises a fresh data directory. Measured after
that: ~90s from `make up` to the API answering.

## What it is

One vertical slice, exercised end to end: a notes list in React that reads and
writes through Spring Boot into SQL Server, with Flyway owning the schema.

```
apps/
  api/    Spring Boot 4.1 · Java 21 · Gradle · JPA · Flyway · springdoc
  web/    React 19 · Vite · TypeScript
infra/
  db/     the one-shot script that creates the database
docs/
  architecture/     how the Docker flow works and why, plus the knowledge graph
  features/         what each app does
  troubleshooting/  the traps, with symptoms
docs-postman/       the Postman collection -- tracked, unlike docs/
```

The database is named **`TESTDB`**. `MSSQL_DB` in `.env` is the one place to
change it; four other files read that variable rather than hard-coding a name.

No root `package.json`. There is no dependency graph spanning a Java and a
TypeScript project, so a Turborepo or Nx root would be ceremony. The `Makefile`
is the task runner.

## Verified working

Not assumed — run against this tree:

- `db-init` creates the database on a fresh volume; `api` waits on its exit
- Flyway applies `V1`; Hibernate's `ddl-auto: validate` agrees with it
- Full CRUD: POST 201, PATCH 200, DELETE 204, blank title 400, unknown id 404
- Non-Latin titles round-trip intact (the `NVARCHAR` decision, asserted)
- Every request lands in `apps/api/logs/api.log` on the host, headers masked
  and bodies capped; the plain-English version is in `activity.log` beside it
- `GET /api/notes?page=0` returns 10 records and a `totalElements`; bare
  `GET /api/notes` still returns a flat array
- Two server-side third-party calls: `api.frankfurter.app` (keyless) and Google
  Places (key held server-side, never in the bundle)
- `make api-test` — 32 tests green against the real SQL Server
- `make postman` — 17 requests, 64 assertions, all passing via `newman`
- `make web-typecheck`, `make web-lint`, `make web-build` — clean
- Hot reload: ~14s first edit, ~8-10s warm

## Stack notes

**SQL Server needs a database created before Flyway can run.** There is no
`POSTGRES_DB` equivalent, so a fresh volume has a server and no application
database, and Flyway fails with `Cannot open database "TESTDB"` — which reads like
a permissions problem and is not one. The `db-init` one-shot service handles it,
and `api` waits on `service_completed_successfully` rather than on the server
being healthy. A healthy server is not the same as an existing database.

**`encrypt=false` in the JDBC URL is not optional locally.** The 12.x driver
defaults to `encrypt=true` and the dev certificate is self-signed, so the
default fails with `PKIX path building failed`.

**Everything by service name, except the browser.** The API reaches SQL Server
at `jdbc:sqlserver://db:1433`; `VITE_API_URL` is `http://localhost:8080`,
because that value is handed to the browser, where `api` does not resolve. Most
early bugs in a setup like this are one of these two halves applied in the wrong
place — [docs/architecture/docker-local.md](docs/architecture/docker-local.md)
has the rule.

**Hot reload works on both sides, and the Java half is not the obvious command.**
`gradle bootRun --continuous` silently never recompiles;
`apps/api/dev-entrypoint.sh` explains why and does the job instead. Expect
~8-10s for a warm Java reload against Vite's sub-100ms. That gap is the JVM, not
Docker.

**Flyway owns the schema, and on SQL Server `validate` is strict about types.**
Three annotations on `Note.java` exist to satisfy it — `@Nationalized` for
`NVARCHAR`, `@JdbcTypeCode(TIMESTAMP)` for `DATETIME2`, and the UUID strategy.
The table of which-pairs-with-what is in
[docs/troubleshooting/sql-server-in-docker.md](docs/troubleshooting/sql-server-in-docker.md).

**Budget ~5GB of RAM.** SQL Server refuses to start below 2GB and the API wants
3g for three concurrent JVMs. This is the main thing you pay for choosing SQL
Server over Postgres here.

**The two apps share generated types, nothing else.** Java and TypeScript have
no source-level overlap, so the API's OpenAPI document is the contract:

```bash
make types    # /v3/api-docs -> apps/web/src/api-types.ts
```

`apps/web/src/api.ts` derives its types from that file, so changing a Java record
without regenerating is a type error rather than a runtime surprise.

**Requests are logged to files, not just the console.** `apps/api/logs/api.log`
has the request/response pair for every call — method, path, masked headers,
body capped at 2 KB, status, duration — and `activity.log` has one plain
sentence per action. Both are on the host without a compose change, because the
`api` service already bind-mounts `./apps/api`.

Every response carries an `X-Request-Id`, and every log line is prefixed with
it, so one `grep` reconstructs a single call end to end. The
[API Playground](http://localhost:5173/apps/api-playground) shows that id next
to each response — see [docs/features/api-playground.md](docs/features/api-playground.md).

## Common targets

```bash
make logs            # or api-logs / web-logs / db-logs -- the console
make api-file-logs   # the two files the API writes, on the host
make db-init-logs    # first stop if the API cannot reach the database
make api-test        # JUnit, against the real SQL Server
make postman         # newman, against the running stack
make web-typecheck   # tsc --noEmit
make db-shell        # sqlcmd, no host install
make db-ui           # CloudBeaver URL + values to paste
make migrate-status  # Flyway history
make fresh           # nuke volumes, recreate the DB, replay from V1
```

## Deliberately missing

No Redis, no worker, no auth, no CI config. Each would follow the same shape as
what is here.

Development connects as `sa`. A real deployment gets a dedicated login with
`db_owner` on this database only, and `sa` disabled.

Also no production Dockerfile. `apps/api/Dockerfile` runs Gradle and mounts
source, which is right for development and wrong for shipping — production is a
separate multi-stage file that `bootJar`s and copies the jar into a JRE-only
image. Conflating them gives you an image that can neither reload nor ship.

If you add CI, add **path filters** in the same commit, so a CSS change does not
run the Gradle suite. Retrofitting that after the build takes eight minutes is
the usual regret.
