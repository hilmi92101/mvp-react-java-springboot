#!/usr/bin/env bash
# Development hot reload for Spring Boot in a container.
#
# WHY THIS SCRIPT EXISTS
#
# The obvious command, `gradle bootRun --continuous`, does not work. Gradle's
# continuous build re-evaluates only after the current build FINISHES, and
# bootRun never finishes -- it blocks for the life of the app. So the watcher
# sits behind a task that will not return, and nothing is ever recompiled. It
# looks like it should work, and it silently doesn't: you edit a controller,
# get no log line, and curl keeps serving the old route.
#
# Hot reload here needs two independent halves:
#
#   1. Something that recompiles Java source into build/classes.
#   2. spring-boot-devtools, which watches the classpath and restarts the
#      Spring context when class files change (~1-3s).
#
# devtools is a dependency and handles (2) on its own. This loop is (1): a
# separate `gradle compileJava` invocation, which acquires the project lock
# fine while bootRun holds it.
#
# WHY POLLING AND NOT inotify
#
# Same reason vite.config.ts sets `usePolling`. Bind-mounted host files on
# WSL2 and macOS do not deliver inotify events into the container, so any
# event-driven watcher sees nothing. `find -newer` against a stamp file is
# crude, costs almost nothing on a tree this size, and actually fires.
set -uo pipefail

# No warm-up compile before bootRun. Measured on the sibling project, it cost
# ~45s and reported compileJava UP-TO-DATE: Gradle's cold daemon start is ~40s
# in this container, and paying it serially before boot just delays the app.
# bootRun compiles what it needs on its way through.

gradle bootRun &
BOOT_PID=$!

STAMP=/tmp/.last-compile
touch "$STAMP"

# Prime a SECOND Gradle daemon, in the background, while the app boots.
#
# This is the fix for "the first edit after startup takes 45s". bootRun pins
# the daemon it runs in for the life of the app, so the recompile loop below
# cannot use it -- it gets its own daemon, and that daemon's cold start is the
# entire 45s. Kicking it off here overlaps that cost with Spring's ~25s boot
# instead of charging it to whoever makes the first edit.
#
# It must be the EXACT command the loop below runs, flags included. A
# `--dry-run` was tried first and did not help: Gradle keys the configuration
# cache on the task set, so priming `compileJava` alone leaves
# `compileJava processResources` still cold, and the first edit paid the full
# ~45s anyway. Same reason --offline appears here -- an online invocation is a
# different key.
# The --offline attempt can fail, and the fallback below is not decoration.
#
# Usually the cache is warm: gradle_cache is a named volume, and Docker seeds a
# named volume from whatever the image has at that path on first mount, so the
# Dockerfile's `gradle dependencies` layer carries over (~134MB, verified).
# But this priming runs CONCURRENTLY with bootRun, and on this project's first
# boot it lost that race and printed "daemon priming failed" -- the first edit
# then took 34s instead of the ~14s it takes now. It has not reproduced since,
# which makes it a race rather than a missing cache, and a race is exactly the
# thing not to leave as a silent 20s tax on whoever boots next.
#
# So: fall back to one online invocation, which cannot fail for want of a
# cache, then re-run the exact offline command.
(
  if gradle compileJava processResources --offline >/dev/null 2>&1; then
    echo "[dev] recompile daemon primed - edits will reload in ~10s"
  else
    echo "[dev] offline priming did not take - retrying online, ~1 min"
    gradle compileJava processResources >/dev/null 2>&1
    # The second offline run is the point. Gradle keys the configuration cache
    # on the task set AND the flags, so the online run above leaves the
    # offline key cold and the first edit would still pay full price.
    if gradle compileJava processResources --offline >/dev/null 2>&1; then
      echo "[dev] recompile daemon primed - edits will reload in ~10s"
    else
      echo "[dev] daemon priming failed; the first edit will be slow"
    fi
  fi
) &

# shellcheck disable=SC2317
cleanup() { kill "$BOOT_PID" 2>/dev/null; }
trap cleanup TERM INT

while kill -0 "$BOOT_PID" 2>/dev/null; do
  if find src -type f \
       \( -name '*.java' -o -name '*.yml' -o -name '*.yaml' \
          -o -name '*.sql' -o -name '*.properties' \) \
       -newer "$STAMP" -print -quit 2>/dev/null | grep -q .; then
    touch "$STAMP"
    echo "[dev] change detected -> recompiling"
    # --offline: a recompile has no business hitting the network, and without
    # this a flaky connection turns a 2s reload into a 30s timeout.
    #
    # Failure is not fatal on purpose. A syntax error should leave the running
    # app on its previous, working classes and print the compiler error --
    # killing the container on every typo would be strictly worse.
    gradle compileJava processResources --offline \
      || echo "[dev] compile failed - app still running on the previous classes"
  fi
  sleep 2
done

wait "$BOOT_PID"
