import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Le catalogue (1 025 espèces, quelque 2 200 cartes) est embarqué pour un Pokédex sans réseau.
    chunkSizeWarningLimit: 1200,
  },
})
