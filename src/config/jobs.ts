/**
 * Les tâches d'ingestion du serveur (`server/ingest.ts`), dans l'ordre où elles passent : leur
 * rythme, et leur nom sur la page Données (qui dit où elles en sont, `/api/status`).
 */

import { DAY, HOUR } from '@/lib/time'

export type IngestJob = 'species' | 'catalog' | 'prices' | 'backups' | 'images'

export const INGEST_JOBS: Record<
  IngestJob,
  {
    label: string
    /** Elle repart quand sa dernière réussite a plus que cet intervalle (ms). */
    every: number
    /** Rien ne manque à l'app tant qu'elle n'est pas passée. */
    optional?: boolean
  }
> = {
  // Les espèces ne changent qu'avec une nouvelle génération.
  species: { label: 'Espèces (PokéAPI)', every: 30 * DAY },
  // De nouvelles cartes quelques fois par mois (Pokécardex : une page par série, toutes les 3 s).
  catalog: { label: 'Catalogue (Pokécardex)', every: DAY },
  // Les prix changent une fois par jour ; la tâche ne retélécharge que ce qui a changé.
  prices: { label: 'Prix (Cardmarket)', every: 6 * HOUR },
  // Les deux bases, copiées chaque jour (`BACKUP_DIR`) ; avant les images, pour ne pas attendre
  // leur premier passage.
  backups: { label: 'Sauvegardes', every: DAY },
  // La dernière : son premier passage (environ 1,5 Go) prend une heure ou plus. En attendant, le
  // serveur copie à la demande les images affichées.
  images: { label: 'Images copiées', every: DAY, optional: true },
}

/** Leurs noms, dans l'ordre où elles passent. */
export const INGEST_JOB_NAMES = Object.keys(INGEST_JOBS) as IngestJob[]
