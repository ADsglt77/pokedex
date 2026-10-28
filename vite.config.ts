import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Le Worker du site (`wrangler.jsonc`) tourne dans Vite, dans le moteur de Cloudflare, avec sa
  // base D1 locale (`.wrangler/`) : `/api` et les images passent par lui.
  plugins: [react(), cloudflare()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // L'état local du Worker (sa base) ne fait pas partie de l'app : le surveiller ralentirait Vite.
    watch: { ignored: ['**/.wrangler/**'] },
    // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
    // chargées à la demande : sans cela, leur première visite attend leur transformation).
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
  },
  // Le site construit (`bun run preview`) au port de `bun dev` : l'adresse du site
  // (`BETTER_AUTH_URL` de `.env`) reste la bonne.
  preview: { port: 5173 },
})
