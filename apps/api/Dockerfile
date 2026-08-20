# Development image. It runs Gradle, not a jar -- the whole point is that the
# dev loop lives in here, so there is no `bootJar` stage and no JRE-only final
# image. A production Dockerfile is a separate, multi-stage file; conflating
# the two gives you an image that can neither reload nor ship.
FROM gradle:9-jdk21

WORKDIR /app

# Manifests first so this layer caches and only re-resolves when dependencies
# change -- the same trick as `COPY package*.json` before `npm ci`.
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
RUN gradle dependencies --no-daemon || true

COPY . .

EXPOSE 8080

# Not `gradle bootRun --continuous` -- that command looks correct and silently
# never recompiles, because continuous build only re-evaluates after a build
# finishes and bootRun never finishes. dev-entrypoint.sh explains the whole
# trap and does the job with a polling recompile loop beside bootRun.
CMD ["./dev-entrypoint.sh"]
