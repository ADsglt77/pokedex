/**
 * Les tests du Worker (`bun run test:worker`) : dans le moteur de Cloudflare (workerd), avec la
 * configuration du Worker (`wrangler.jsonc`) et une base D1 neuve, migrée comme celle du site
 * (`worker/tests/setup.ts`). Leurs propres variables, jamais celles de `.env` ; l'API des données
 * n'existe pas (`data.ts` est testé sans elle).
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
          DATA_API_URL: 'http://donnees.invalid',
          DATA_API_TOKEN: 'token-d-essai',
          MIGRATIONS: await readD1Migrations('worker/migrations'),
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
