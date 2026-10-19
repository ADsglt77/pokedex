import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** Le serveur de l'app en développement (`bun run dev:server`) ; sur le VPS, nginx y renvoie. */
const API = 'http://127.0.0.1:3000'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // L'API des données (le dépôt `pokedex-data`, `bun run dev` : port 3001), jointe comme le fait
  // nginx sur le VPS (`deploy/nginx.conf.template`) : ses chemins sous `/v1` (`/api/x` → `/v1/x`,
  // `/images/x` → `/v1/images/x`), avec le token du site (`DATA_API_TOKEN`, dans `.env`), que le
  // navigateur ne voit jamais.
  const data = {
    target: 'http://127.0.0.1:3001',
    rewrite: (path: string) => '/v1' + path.replace(/^\/api/, ''),
    headers: { Authorization: `Bearer ${loadEnv(mode, process.cwd(), '').DATA_API_TOKEN ?? ''}` },
  }
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // Les données (espèces, catalogue, prix, état des tâches, images) à l'API des données ; le
      // reste de `/api` (compte, collection, Pokédex public) au serveur de l'app.
      proxy: {
        '^/api/(species|catalog|prices|histories|wants|status|health)([/?]|$)': data,
        '/images/': data,
        '/api': API,
      },
      // Les bases du serveur (et son cache) ne font pas partie de l'app : les surveiller
      // ralentirait Vite.
      watch: { ignored: ['**/.data/**'] },
      // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
      // chargées à la demande : sans cela, leur première visite attend leur transformation).
      warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
    },
  }
})
