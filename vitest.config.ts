/**
 * Les tests du Worker (`bun run test:worker`) : dans le moteur de Cloudflare (workerd), avec la
 * configuration du Worker (`wrangler.jsonc`) et une base D1 neuve, migrée comme celle du site
 * (`worker/tests/setup.ts`). Leurs propres variables, jamais celles de `.env` ; le Worker des données
 * n'y est pas (`DATA`, testé sans lui).
 */

import { fileURLToPath, URL } from 'node:url'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          BETTER_AUTH_URL: 'http://localhost:5173',
          BETTER_AUTH_SECRET: 'cle-d-essai-pour-les-tests-du-worker-seulement',
          MIGRATIONS: await readD1Migrations('worker/migrations'),
        },
        serviceBindings: {
          // Le Worker des données : absent (404), sauf là où un test le remplace (`env.DATA`).
          DATA: () => new Response(null, { status: 404 }),
          // Les fichiers de l'app, sans eux : la page de l'app pour toute adresse, ce que rend
          // `env.ASSETS` en ligne pour une adresse qui n'est pas un fichier.
          ASSETS: () =>
            new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }),
        },
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['worker/tests/**/*.test.ts'],
    setupFiles: ['./worker/tests/setup.ts'],
  },
}))
