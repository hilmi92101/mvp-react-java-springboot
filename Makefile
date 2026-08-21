.PHONY: help up down build logs fresh api web db-shell db-ui \
	api-logs web-logs db-logs db-init-logs \
	api-test api-integration-test api-build web-install web-add web-typecheck web-lint web-build \
	web-test web-test-watch test \
	migrate-status migrate-repair types api-restart web-restart \
	postman api-file-logs \
	graph graph-update graph-open graph-query graph-relabel

# Every target here is `docker compose` underneath. Nothing in this project
# needs a JDK, Gradle, Node, or sqlcmd on the host -- Docker is the only
# prerequisite, and that is the property the whole setup exists to protect.

# Repeated in three targets, so it lives in one place. -C trusts the server's
# self-signed dev certificate, which the 18.x tools require.
SQLCMD = /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa \
	-P "$${MSSQL_SA_PASSWORD:-Local_Dev_Pass123}" -d $${MSSQL_DB:-TESTDB}

help:
	@grep -E '^[a-z-]+:.*?##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | expand -t22

up: ## Start everything in the background
	docker compose up -d

down: ## Stop everything, keep the database volume
	docker compose down

build: ## Rebuild both app images
	docker compose build

logs: ## Tail every service
	docker compose logs -f

api-logs: ## Tail the Spring Boot log
	docker compose logs -f api

web-logs: ## Tail the Vite log
	docker compose logs -f web

db-logs: ## Tail SQL Server
	docker compose logs -f db

# The first place to look when the API cannot reach the database: if this did
# not exit 0, `api` never started, because it waits on completion not health.
db-init-logs: ## Show what the database-creation step did
	docker compose logs db-init

# Wipes the database volume too. This is the "I broke the schema" button:
# db-init recreates the database and migrations replay from V1.
fresh: ## Nuke volumes and rebuild from scratch
	docker compose down -v
	docker compose build
	docker compose up -d

api: ## Shell into the API container
	docker compose exec api bash

web: ## Shell into the web container
	docker compose exec web sh

db-shell: ## sqlcmd inside the db container
	docker compose exec db $(SQLCMD)

# Starts the service first. Printing a URL without checking the container is
# up is how you get a dead link and conclude the stack has no database UI --
# `dbui` was added after `db` and `api`, so an older `make up` never started it.
db-ui: ## Start CloudBeaver, print its URL and the connection values to paste
	@docker compose up -d dbui
	@echo
	@echo "http://localhost:$${DBUI_PORT:-8978}"
	@echo
	@echo "First visit runs an admin-setup wizard, then add a connection:"
	@echo "  Driver    SQL Server"
	@echo "  Host      db          <- the compose service name, not localhost"
	@echo "  Port      1433"
	@echo "  Database  $${MSSQL_DB:-TESTDB}"
	@echo "  User      sa"
	@echo "  Password  $${MSSQL_SA_PASSWORD:-Local_Dev_Pass123}"
	@echo "  Trust server certificate: ON  <- the dev cert is self-signed"

migrate-status: ## Show Flyway's applied-migration history
	docker compose exec db $(SQLCMD) -Q \
		"SET NOCOUNT ON; SELECT installed_rank, version, description, success \
		 FROM dbo.flyway_schema_history ORDER BY installed_rank;"

# Flyway checksums the whole migration file, comments included. Editing an
# already-applied migration -- even a stale doc link in a comment -- makes it
# refuse to validate, and the API then never starts. The real fix is to never
# edit an applied migration; this target is for when someone already did.
#
# The checksum to pass is the "Resolved locally" number Flyway prints in
# `docker compose logs api`, i.e. the fingerprint of the file as it is now:
#   make migrate-repair VERSION=2 CHECKSUM=-1404914517
migrate-repair: ## Re-point one applied migration's checksum at the current file
	@test -n "$(VERSION)"  || (echo "VERSION= is required (e.g. VERSION=2)"; exit 1)
	@test -n "$(CHECKSUM)" || (echo "CHECKSUM= is required -- the 'Resolved locally' value from the api logs"; exit 1)
	docker compose exec db $(SQLCMD) -Q \
		"UPDATE dbo.flyway_schema_history SET checksum = $(CHECKSUM) \
		 WHERE version = '$(VERSION)';"

# The `test` task excludes the `integration` tag, so this is the unit half
# only and passes with the db container stopped. The other half is
# `api-integration-test`; `make test` runs both.
api-test: ## Run the Spring Boot unit tests (no database needed)
	docker compose exec api gradle test

# Only the tests tagged `integration` -- everything that needs the db
# container. Useful on its own while working on one of them.
api-integration-test: ## Run only the database-backed tests
	docker compose exec api gradle integrationTest

api-build: ## Full compile, excluding tests
	docker compose exec api gradle build -x test

# node_modules is a named volume, so a dependency added to package.json on the
# host is invisible to the container until this runs. It also rewrites the
# bind-mounted package-lock.json, which is what `npm ci` in the Dockerfile
# needs -- an out-of-sync lock makes the next image build fail, not warn.
#
# `run --rm`, not `exec`: the missing dependency is usually what crashed the
# dev server, and `exec` cannot attach to a restarting container. A one-off
# container shares the same node_modules volume, so the install still lands.
web-install: ## Install apps/web dependencies inside the container
	docker compose run --rm --no-deps web npm install
	docker compose up -d web

# `make web-add PKG=redux-saga` -- or PKG="a b c" for several at once. Same
# `run --rm` reasoning as web-install: a one-off container writes into the
# shared node_modules volume and into the bind-mounted package.json/lock, so
# the host stays the source of truth. Adding a *dev* dependency:
# `make web-add PKG="-D @types/google.maps"`.
web-add: ## Add a dependency inside the container (PKG=name, or PKG="-D name")
	@test -n "$(PKG)" || { echo 'usage: make web-add PKG=<package>'; exit 1; }
	docker compose run --rm --no-deps web npm install $(PKG)
	docker compose up -d web

web-typecheck: ## tsc, no emit
	docker compose exec web npx tsc -b --noEmit

web-lint: ## oxlint
	docker compose exec web npm run lint

# In the container, not on the host: node_modules lives in a named volume the
# host cannot see, so a host `npx vitest` would not find the runner at all.
# `exec`, not `run --rm`: the dev server is already up and reusing it skips a
# container start per run.
web-test: ## Run the Vitest suite once
	docker compose exec web npm test

web-test-watch: ## Run Vitest in watch mode
	docker compose exec web npm run test:watch

# Every suite, in the order that fails cheapest first: Vitest, then the backend
# unit tests, then the database-backed ones. Sequential and fail-fast on
# purpose -- make stops at the first non-zero exit, so a red frontend does not
# wait on a JVM. The db container must be up for the last one.
test: web-test api-test api-integration-test ## Run every suite: web, api unit, api integration

web-build: ## Production Vite build
	docker compose exec web npm run build

# Rebuild Vite's module graph. Needed after moving or renaming a file under
# apps/web/src: the importer keeps serving the old path and the route dies
# with "Failed to fetch dynamically imported module". A browser reload cannot
# fix it -- the stale import is in what the dev server returns.
web-restart: ## Restart the Vite dev server
	docker compose restart web

api-restart: ## Restart Spring Boot (needed after a build.gradle.kts change)
	docker compose restart api

# The only code the two apps share. Java and TypeScript have no source-level
# overlap, so the API's OpenAPI document is the contract and this generates
# the frontend's half of it. Commit the output once this is a repo -- CI should
# not need a running API, and a diff here is exactly the review signal you
# want when an endpoint's shape changes.
# Runs inside the `web` container rather than on the host, for the same reason
# every other target does: Docker is the only prerequisite this project has, and
# newman would otherwise need Node installed. `--no-deps` because the stack must
# already be up -- newman testing a stack it just started would be testing a
# cold JVM. baseUrl is `api:8080`, the compose service name, because the request
# comes from inside the network here and not from the host.
postman: ## Run the docs-postman collection against the running stack
	docker compose run --rm --no-deps -v "$(PWD)/docs-postman:/pm:ro" web \
		npx --yes newman run /pm/mvp-api.postman_collection.json \
		--env-var baseUrl=http://api:8080

# Not `docker compose logs`: that shows the console, and the console is not the
# file. These two are what the logging requirement actually produced, and they
# are on the host because compose bind-mounts ./apps/api into the container.
api-file-logs: ## Tail the two log files RequestLoggingFilter and ActivityLog write
	tail -f apps/api/logs/api.log apps/api/logs/activity.log

types: ## Generate apps/web/src/api-types.ts from the API's OpenAPI doc
	curl -sf http://localhost:$${API_PORT:-8080}/v3/api-docs -o apps/web/openapi.json
	docker compose exec web npx --yes openapi-typescript openapi.json -o src/api-types.ts
	@rm -f apps/web/openapi.json
	@echo "wrote apps/web/src/api-types.ts"

# graphify is the one thing here that runs on the host rather than in a
# container: it reads the working tree directly and writes graphify-out/, which
# is gitignored. Install once with `uv tool install "graphifyy[sql]"` -- the sql
# extra is what lets it see the Flyway migrations.
graph: ## Rebuild the knowledge graph from scratch (graphify-out/)
	graphify extract --force .
	graphify export html

graph-update: ## Re-extract only changed files (AST-only, no API cost)
	graphify update .

graph-open: ## Print the path to the interactive graph
	@echo "file://$(CURDIR)/graphify-out/graph.html"

# Quote the question: make graph-query Q="how does request logging work"
graph-query: ## Ask the graph a question (Q="...")
	@test -n "$(Q)" || { echo 'usage: make graph-query Q="your question"'; exit 1; }
	@graphify query "$(Q)"

# Community names are written by an agent, not by graphify -- there is no LLM
# backend configured here, so `graphify label` would fall back to "Community N".
# The names survive graph-update as long as the community count is unchanged; add
# or delete enough files and graphify re-clusters and renames them by hub. This
# restores the curated set. If the count itself changed, the mapping is stale --
# ask Claude to relabel, then `cp` the result over the .curated.json.
graph-relabel: ## Restore the curated community names into the graph
	@test -f graphify-out/.graphify_labels.curated.json \
		|| { echo "no curated labels: graphify-out/.graphify_labels.curated.json missing"; exit 1; }
	@cp graphify-out/.graphify_labels.curated.json graphify-out/.graphify_labels.json
	@graphify cluster-only . --no-label
