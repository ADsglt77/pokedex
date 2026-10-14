import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Le serveur de l'app en développement (`bun run dev:server`) ; sur le VPS, nginx y renvoie. */
const API = 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': API, '/images': API },
    // Ni les bases du serveur (et son cache) ni les anciens prix ne font partie de l'app : les
    // surveiller ralentirait Vite.
    watch: { ignored: ['**/.data/**', '**/prices/**'] },
    // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
    // chargées à la demande : sans cela, leur première visite attend leur transformation).
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
  },
})
