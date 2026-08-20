.PHONY: help up down build logs fresh api web db-shell db-ui \
	api-logs web-logs db-logs db-init-logs \
	api-test api-build web-install web-add web-typecheck web-lint web-build \
	migrate-status types api-restart web-restart

# Every target here is `docker compose` underneath. Nothing in this project
# needs a JDK, Gradle, Node, or sqlcmd on the host -- Docker is the only
# prerequisite, and that is the property the whole setup exists to protect.

# Repeated in three targets, so it lives in one place. -C trusts the server's
# self-signed dev certificate, which the 18.x tools require.
SQLCMD = /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa \
	-P "$${MSSQL_SA_PASSWORD:-Local_Dev_Pass123}" -d $${MSSQL_DB:-mvp}

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
	@echo "  Database  $${MSSQL_DB:-mvp}"
	@echo "  User      sa"
	@echo "  Password  $${MSSQL_SA_PASSWORD:-Local_Dev_Pass123}"
	@echo "  Trust server certificate: ON  <- the dev cert is self-signed"

migrate-status: ## Show Flyway's applied-migration history
	docker compose exec db $(SQLCMD) -Q \
		"SET NOCOUNT ON; SELECT installed_rank, version, description, success \
		 FROM dbo.flyway_schema_history ORDER BY installed_rank;"

api-test: ## Run the Spring Boot test suite
	docker compose exec api gradle test

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
types: ## Generate apps/web/src/api-types.ts from the API's OpenAPI doc
	curl -sf http://localhost:$${API_PORT:-8080}/v3/api-docs -o apps/web/openapi.json
	docker compose exec web npx --yes openapi-typescript openapi.json -o src/api-types.ts
	@rm -f apps/web/openapi.json
	@echo "wrote apps/web/src/api-types.ts"
