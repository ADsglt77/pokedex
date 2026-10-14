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
  // Les 1 025 espèces sont embarquées : le Pokédex s'affiche sans attendre le réseau. Le seuil
  // laisse de la marge (600 Ko en octobre 2026) : au-delà, se demander quoi charger à la demande.
  build: { chunkSizeWarningLimit: 700 },
  server: {
    proxy: { '/api': API, '/images': API },
    // Ni les bases du serveur, ni les anciens prix, ni le cache des scripts ne font partie de
    // l'app : les surveiller ralentirait Vite.
    watch: { ignored: ['**/.data/**', '**/prices/**', '**/scripts/.cache/**'] },
    // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
    // chargées à la demande : sans cela, leur première visite attend leur transformation).
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
  },
})
