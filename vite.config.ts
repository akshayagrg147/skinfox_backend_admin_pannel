import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Keep the browser on the local origin while allowing local development to
  // use the hosted API (and therefore the hosted database) through Vite's
  // server-side proxy. This also keeps session cookies same-origin in dev.
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:4000'

  return {
    plugins: [react()],
    server: {
      port: 4173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})
