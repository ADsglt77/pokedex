import { readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const PRICES_DIR = fileURLToPath(new URL('./prices', import.meta.url))

/**
 * En développement, `/prices/` vient du dossier `prices/` (écrit par `bun run prices`) : dans
 * `public/`, ses dizaines de milliers d'historiques bloqueraient Vite. Sur le VPS, nginx les sert.
 */
const devPrices: Plugin = {
  name: 'dev-prices',
  configureServer(server) {
    server.middlewares.use('/prices', (request, response) => {
      const file = resolve(join(PRICES_DIR, decodeURIComponent(request.url!.split('?')[0]!)))
      if (!file.startsWith(PRICES_DIR + sep)) {
        response.statusCode = 404
        return response.end()
      }
      readFile(file).then(
        (body) => {
          response.setHeader('Content-Type', 'application/json')
          response.end(body)
        },
        () => {
          response.statusCode = 404
          response.end()
        },
      )
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devPrices],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Les 1 025 espèces sont embarquées : le Pokédex s'affiche sans attendre le réseau. Le seuil
  // laisse de la marge (600 Ko en octobre 2026) : au-delà, se demander quoi charger à la demande.
  build: { chunkSizeWarningLimit: 700 },
  server: {
    // Ni les prix ni le cache des scripts ne font partie de l'app : les surveiller ralentirait Vite.
    watch: { ignored: ['**/prices/**', '**/scripts/.cache/**'] },
    // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
    // chargées à la demande : sans cela, leur première visite attend leur transformation).
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
  },
})
