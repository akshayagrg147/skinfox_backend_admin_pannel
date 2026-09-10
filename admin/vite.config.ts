import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  publicDir: '../public',
  server: {
    port: 4174,
    proxy: { '/api': 'http://localhost:4000' },
  },
})
