import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `BASE_PATH` lets us deploy under a subdirectory (GitHub Pages: /WoodPeckerApp/)
// without touching the source. Locally it stays at the root.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
})
