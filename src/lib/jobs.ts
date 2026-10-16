/** Où en est une tâche d'ingestion : la page Données le montre, `/api/health` le surveille. */

import { INGEST_JOBS, type IngestJob } from '@/config/jobs'

/**
 * Deux intervalles sans réussite (ou jamais réussie) : le serveur ne la relance plus (service
 * arrêté ?), ou elle échoue sans cesse. `now` : en ms.
 */
export const isOverdue = (job: IngestJob, lastSuccess: string | null, now: number) =>
  lastSuccess === null || now - Date.parse(lastSuccess) > 2 * INGEST_JOBS[job].every
