import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Le serveur de l'app en développement (`bun run dev:server`) ; sur le VPS, nginx y renvoie. */
const API = 'http://localhost:3000'

/**
 * Le service worker (`public/sw.js`) reçoit la liste des fichiers du site construit, qu'il garde
 * pour démarrer hors ligne : la page, les scripts, styles et polices, et ce que la page demande de
 * `public/` au démarrage. Elle change à chaque construction : le navigateur installe alors la
 * nouvelle version du service worker.
 */
function precache(): Plugin {
  let files: string[] = []
  let outDir = 'dist'
  return {
    name: 'precache',
    apply: 'build',
    configResolved: (config) => {
      outDir = join(config.root, config.build.outDir)
    },
    generateBundle: (_options, bundle) => {
      files = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map'))
        .map((file) => `/${file}`)
    },
    closeBundle: () => {
      const path = join(outDir, 'sw.js')
      const list = [
        ...files,
        '/theme.js',
        '/favicon.svg',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
      ]
      writeFileSync(
        path,
        readFileSync(path, 'utf8').replace('self.__PRECACHE__', JSON.stringify(list)),
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
    // Ni les bases du serveur (et son cache) ni les anciens prix ne font partie de l'app : les
    // surveiller ralentirait Vite.
    watch: { ignored: ['**/.data/**', '**/prices/**'] },
    // Les pages préparées dès le démarrage, pas à leur première ouverture (Achats, Valeur… sont
    // chargées à la demande : sans cela, leur première visite attend leur transformation).
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/**/*.tsx'] },
  },
})
