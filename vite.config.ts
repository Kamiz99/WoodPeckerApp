import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `BASE_PATH` lets us deploy under a subdirectory (GitHub Pages: /WoodPeckerApp/)
// without touching the source. Locally it stays at the root.
// `SINGLE_FILE=1` produce un build que cabe entero en un solo HTML: sin trozos
// separados y con los assets incrustados (ver scripts/build-single-file.mjs).
const singleFile = process.env.SINGLE_FILE === '1'

export default defineConfig({
  base: singleFile ? './' : process.env.BASE_PATH || '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    outDir: singleFile ? 'dist-single' : 'dist',
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 10_000_000 : 4096,
    rollupOptions: singleFile ? { output: { inlineDynamicImports: true } } : {},
  },
})
