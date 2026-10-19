import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { API_FORMAT } from './src/config/api'

/** Le serveur de l'app en développement (`bun run dev:server`) ; sur le VPS, nginx y renvoie. */
const API = 'http://127.0.0.1:3000'

/**
 * Le service worker (`public/sw.js`) reçoit la liste des fichiers du site construit, qu'il garde
 * pour démarrer hors ligne : la page, les scripts, styles et polices (`.woff2` seulement : les
 * `.woff` ne servent qu'aux navigateurs sans `.woff2`), et ce que la page demande de `public/` au
 * démarrage. `/index.html` est écrit à la main : ce plugin passe avant celui de Vite qui l'ajoute
 * au site. La liste change à chaque construction : le navigateur installe alors la nouvelle
 * version du service worker. Il reçoit aussi la forme des réponses de l'API (`API_FORMAT`), qui
 * nomme le cache de ses copies. Chaque marqueur doit y être une fois exactement : sinon une
 * erreur, plutôt qu'un service worker qui ne garderait rien sans le dire.
 */
function precache(): Plugin {
  let files: string[] = []
  let outDir = 'dist'
  /** Remplace `marker` (une fois exactement) par `value`, en JSON. */
  const inject = (text: string, marker: string, value: unknown) => {
    const count = text.split(marker).length - 1
    if (count !== 1) throw new Error(`sw.js : ${count} fois ${marker}, 1 attendu`)
    // Une fonction : `$&` ou `$$` dans la valeur ne seraient pas lus comme des motifs.
    return text.replace(marker, () => JSON.stringify(value))
  }
  return {
    name: 'precache',
    apply: 'build',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle: (_options, bundle) => {
      files = Object.keys(bundle)
        .filter((file) => !/\.(map|woff)$/.test(file))
        .map((file) => `/${file}`)
    },
    closeBundle: () => {
      const path = resolve(outDir, 'sw.js')
      const list = [
        ...files,
        '/index.html',
        '/theme.js',
        '/favicon.svg',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
      ]
      const text = readFileSync(path, 'utf8')
      writeFileSync(
        path,
        inject(inject(text, 'self.__PRECACHE__', list), 'self.__API_FORMAT__', API_FORMAT),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precache()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': API, '/images': API },
    // Les bases du serveur (et son cache) ne font pas partie de l'app : les surveiller
    // ralentirait Vite.
    watch: { ignored: ['**/.data/**'] },
    // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
    // chargées à la demande : sans cela, leur première visite attend leur transformation).
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
  },
})
