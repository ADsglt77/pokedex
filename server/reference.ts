/**
 * Les données de référence, publiques, que remplissent les tâches d'ingestion (`ingest.ts`) :
 * - `GET /api/status` : la dernière réussite et le dernier passage de chaque tâche ;
 * - `GET /api/species`, `/api/species/details` : les espèces, et ce qu'en montre la fiche ;
 * - `GET /api/catalog` : le catalogue des cartes japonaises ;
 * - `GET /api/prices` : les prix Cardmarket du jour ; `GET /api/prices/:id` : l'historique d'une
 *   carte Cardmarket, par son id produit.
 * Les grosses réponses sont servies telles que calculées en fin de tâche (`snapshots.ts`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { readHistory } from './history'
import { serveSnapshot } from './snapshots'

export function referenceRoutes(data: Database) {
  const runs = data.query(
    `SELECT job, MAX(CASE WHEN ok = 1 THEN finished_at END) AS lastSuccess,
            MAX(finished_at) AS lastRun
     FROM runs GROUP BY job`,
  )
  /** Une réponse calculée en fin de tâche. */
  const snapshot =
    (name: string) =>
    ({ request }: { request: Request }) =>
      serveSnapshot(data, name, request)
  /** Sa description dans la documentation de l'API. */
  const doc = (summary: string) => ({ detail: { summary, tags: ['Référence'] } })

  return new Elysia({ name: 'reference' })
    .get(
      '/status',
      ({ set }) => {
        set.headers['cache-control'] = 'no-cache'
        const rows = runs.all() as {
          job: string
          lastSuccess: string | null
          lastRun: string | null
        }[]
        return Object.fromEntries(rows.map(({ job, ...times }) => [job, times]))
      },
      doc('Les tâches d’ingestion'),
    )
    .get('/species', snapshot('species'), doc('Les espèces : noms, types, génération'))
    .get(
      '/species/details',
      snapshot('species-details'),
      doc('Les détails des espèces : catégorie, description, taille…'),
    )
    .get('/catalog', snapshot('catalog'), doc('Le catalogue des cartes japonaises'))
    .get('/prices', snapshot('prices'), doc('Les prix du jour'))
    .get(
      '/prices/:id',
      ({ params, set, status }) => {
        const history = readHistory(data, params.id)
        if (!history) return status(404, null)
        set.headers['cache-control'] = 'no-cache'
        return history
      },
      {
        params: t.Object({ id: t.Integer({ minimum: 1, maximum: 999_999_999 }) }),
        ...doc('L’historique des prix d’une carte Cardmarket'),
      },
    )
}
