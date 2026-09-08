import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Production nginx hosts the portal beneath the public SkinFox origin while
  // local development keeps its dedicated Vite port.
  base: process.env.VITE_AFFILIATE_BASE ?? '/',
  plugins: [react()],
  server: { port: 4175, proxy: { '/api': 'http://localhost:4000' } },
})
