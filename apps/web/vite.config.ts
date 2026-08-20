import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
