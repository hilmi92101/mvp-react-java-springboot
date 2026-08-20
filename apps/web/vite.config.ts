import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
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
