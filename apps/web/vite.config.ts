import { fileURLToPath } from 'node:url'
// `vitest/config` re-exports Vite's own defineConfig with the `test` key added.
// Importing it from 'vite' instead type-errors on that key under `tsc -b`.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Mirrors the `@/*` path in tsconfig.app.json. Both have to exist:
      // TypeScript resolves the alias for type-checking, Vite for the bundle.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom, not node: component tests in Batch B need a DOM, and a per-file
    // environment comment is one more thing to forget on a new file.
    environment: 'jsdom',
    // `describe`/`it`/`expect` without an import in every file, matching how
    // the rest of the repo's tooling behaves. jest-dom's matchers are
    // registered in the setup file below.
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Bind-mounted files on WSL2 and macOS do not deliver inotify events to
      // the container, so the default watcher sees nothing and HMR silently
      // stops working. Polling costs a little CPU and is the only thing that
      // reliably fires. Drop this if you develop on native Linux.
      usePolling: true,
      interval: 300,
    },
  },
})
