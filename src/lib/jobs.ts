/** Où en est une tâche d'ingestion : la page Données le montre, `/api/health` le surveille. */

import { INGEST_JOBS, type IngestJob } from '@/config/jobs'
import { DAY } from '@/lib/time'

/**
 * Deux intervalles sans réussite (ou jamais réussie) : le serveur ne la relance plus (service
 * arrêté ?), ou elle échoue sans cesse. `now` : en ms.
 */
export const isOverdue = (job: IngestJob, lastSuccess: string | null, now: number) =>
  lastSuccess === null || now - Date.parse(lastSuccess) > 2 * INGEST_JOBS[job].every

/**
 * Le guide des prix en base (`pricesDate`, son jour) a plus de deux jours : la tâche réussit,
 * mais Cardmarket ne le régénère plus (« inchangé » à chaque passage). Chaque jour sans prix est
 * un trou dans l'historique, qui ne se rattrape jamais. `now` : en ms.
 */
export const pricesFrozen = (pricesDate: string | null, now: number) =>
  pricesDate !== null && now - Date.parse(pricesDate) > 2 * DAY
