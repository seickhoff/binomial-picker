import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // three and its post-processing stack are large by nature; the warning is
    // noise here, and the bundle is one static asset on a CDN.
    chunkSizeWarningLimit: 1600,
  },
})
