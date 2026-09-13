import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:4000'

  return {
    // Production nginx hosts the portal beneath the public SkinFox origin
    // while local development keeps its dedicated Vite port.
    base: env.VITE_AFFILIATE_BASE ?? '/',
    plugins: [react()],
    envDir: '..',
    server: {
      port: 4175,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
