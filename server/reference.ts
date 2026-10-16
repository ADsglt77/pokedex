/**
 * Les données de référence, publiques, que remplissent les tâches d'ingestion (`ingest.ts`) :
 * - `GET /api/status` : la dernière réussite et le dernier passage de chaque tâche, et le jour des
 *   prix en base (la page Données le montre) ;
 * - `GET /api/health` : pour une surveillance (UptimeRobot…), 200 si chaque tâche nécessaire a
 *   réussi récemment (deux intervalles au plus, `isOverdue`), 503 sinon, avec les tâches en retard ;
 * - `GET /api/species`, `/api/species/details` : les espèces, et ce qu'en montre la fiche ;
 * - `GET /api/catalog` : le catalogue des cartes japonaises ;
 * - `GET /api/prices` : les prix Cardmarket du jour ; `GET /api/prices/:id` : l'historique d'une
 *   carte Cardmarket, par son id produit.
 * Les grosses réponses sont servies telles que calculées en fin de tâche (`snapshots.ts`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { INGEST_JOB_NAMES, INGEST_JOBS } from '@/config/jobs'
import { isOverdue } from '@/lib/jobs'
import type { JobStatus, ServerStatus } from '@/types'
import { readSource } from './db'
import { readHistory } from './history'
import { notFound, serveSnapshot } from './snapshots'

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
      ({ set }): ServerStatus => {
        set.headers['cache-control'] = 'no-cache'
        const rows = runs.all() as ({ job: string } & JobStatus)[]
        return {
          jobs: Object.fromEntries(rows.map(({ job, ...times }) => [job, times])),
          pricesDate: readSource(data, 'cardmarket')?.date ?? null,
        }
      },
      doc('Les tâches d’ingestion'),
    )
    .get(
      '/health',
      ({ set }) => {
        set.headers['cache-control'] = 'no-store'
        const rows = runs.all() as ({ job: string } & JobStatus)[]
        const successes = new Map(rows.map(({ job, lastSuccess }) => [job, lastSuccess]))
        const now = Date.now()
        // Les images sont facultatives : le serveur copie à la demande celles affichées.
        const late = INGEST_JOB_NAMES.filter(
          (job) => !INGEST_JOBS[job].optional && isOverdue(job, successes.get(job) ?? null, now),
        )
        if (late.length > 0) set.status = 503
        return { ok: late.length === 0, late }
      },
      doc('Pour une surveillance : 503 si une tâche nécessaire est en retard'),
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
      ({ params, set }) => {
        const history = readHistory(data, params.id)
        // Sans cache, comme l'historique : la carte peut avoir un prix au prochain passage.
        if (!history) return notFound()
        set.headers['cache-control'] = 'no-cache'
        return history
      },
      {
        params: t.Object({ id: t.Integer({ minimum: 1, maximum: 999_999_999 }) }),
        ...doc('L’historique des prix d’une carte Cardmarket'),
      },
    )
}
