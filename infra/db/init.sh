#!/usr/bin/env bash
# Creates the application database, once, after the server is up.
#
# WHY THIS EXISTS AT ALL
#
# Postgres has POSTGRES_DB: name it and the image creates it during
# initialisation. SQL Server has no equivalent. MSSQL_SA_PASSWORD creates the
# `sa` login and nothing else, so a fresh volume gives you a server with only
# the system databases -- and Flyway's very first act is to connect to a
# database that does not exist yet. The failure is
# "Cannot open database "mvp" requested by the login", which reads like a
# permissions problem and is not one.
#
# So this runs as a one-shot compose service between `db` and `api`. `api`
# waits on `service_completed_successfully`, which means the ordering is
# enforced by compose rather than by a sleep.
set -euo pipefail

DB="${MSSQL_DB:?}"
PW="${MSSQL_SA_PASSWORD:?}"
HOST="${MSSQL_HOST:-db}"

# The tools moved directory between image generations: 2019 ships
# mssql-tools, 2022 ships mssql-tools18. Probing beats hardcoding one and
# discovering the other at 2am.
SQLCMD=""
for c in /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd; do
  [ -x "$c" ] && SQLCMD="$c" && break
done
[ -n "$SQLCMD" ] || { echo "[db-init] no sqlcmd in this image" >&2; exit 1; }

# -C trusts the server certificate. The 18.x tools encrypt by default and
# reject SQL Server's self-signed dev cert without it; the 17.x tools ignore
# the flag. Local development only -- see the note in docker-local.md.
run() { "$SQLCMD" -C -S "$HOST" -U sa -P "$PW" -b -Q "$1"; }

# The server accepts TCP connections a little before it will accept logins, so
# healthcheck-passed is necessary and not quite sufficient. Retry rather than
# sleep a magic number.
for i in $(seq 1 30); do
  run "SELECT 1" >/dev/null 2>&1 && break
  echo "[db-init] waiting for sqlserver login ($i/30)"
  sleep 2
done

# Idempotent: this service re-runs on every `docker compose up`, and only the
# first run on a fresh volume has work to do.
run "IF DB_ID('$DB') IS NULL BEGIN CREATE DATABASE [$DB]; END"

# READ_COMMITTED_SNAPSHOT is off by default on SQL Server, which means plain
# readers take shared locks and block behind writers. That default surprises
# everyone arriving from Postgres, where MVCC reads never block. Turning it on
# here makes the dev database behave the way the application code assumes.
run "ALTER DATABASE [$DB] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE"

echo "[db-init] database [$DB] ready"
