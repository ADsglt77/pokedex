/**
 * Les tâches d'ingestion : chacune lit une ou plusieurs sources et écrit dans `data.db`.
 *
 *   bun server/ingest.ts <tâche>     une tâche, tout de suite (`bun run ingest catalog`)
 *   bun server/ingest.ts --loop      service `ingest` : chaque tâche à son rythme
 *   bun server/ingest.ts legacy-prices <dossier>   reprise des anciens fichiers de prix
 *
 * En boucle, au démarrage : les réponses calculées de l'API (`snapshots`) sont refaites (leur
 * forme a pu changer avec le code déployé) : le catalogue et les prix d'après leurs tables, les
 * espèces en repassant leur tâche (elle relit le cache disque de PokéAPI, sans requête s'il a moins
 * d'un mois). La reprise des anciens fichiers de prix (`LEGACY_PRICES`, `legacy-prices.ts`) passe
 * d'abord, si la base n'a pas encore d'historique : la tâche `prices` n'écrit qu'ensuite.
 * En boucle, une tâche repart quand sa dernière réussite a plus que son intervalle
 * (`INGEST_JOBS`) ; après un échec (source indisponible…), 10 min plus tard, puis 20, 40… jusqu'à
 * 6 h : une panne qui dure ne fait pas solliciter la source toutes les 10 min. Chaque passage est
 * noté dans `runs` (lu par `/api/status`, que montre la page Données).
 */

import type { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { INGEST_JOBS, type IngestJob } from '@/config/jobs'
import { openData, readSource } from './db'
import { backups } from './jobs/backups'
import { catalog, catalogSnapshot } from './jobs/catalog'
import { images } from './jobs/images'
import { prices, pricesSnapshot } from './jobs/prices'
import { species } from './jobs/species'
import { hasHistory, importLegacyPrices } from './legacy-prices'
import { saveSnapshot } from './snapshots'

const HOUR = 3_600_000

/** Chaque tâche, dans l'ordre d'`INGEST_JOBS` (leur rythme) : les images suivent le catalogue. */
const RUNS: Record<IngestJob, (db: Database) => Promise<void>> = {
  species,
  catalog,
  prices,
  images,
  backups,
}
const NAMES = Object.keys(INGEST_JOBS) as IngestJob[]

async function runJob(db: Database, name: IngestJob) {
  const now = () => new Date().toISOString()
  const { id } = db
    .query('INSERT INTO runs (job, started_at) VALUES (?, ?) RETURNING id')
    .get(name, now()) as { id: number }
  const finish = (ok: boolean, message: string | null) =>
    db
      .query('UPDATE runs SET finished_at = ?, ok = ?, message = ? WHERE id = ?')
      .run(now(), ok ? 1 : 0, message, id)
  try {
    await RUNS[name](db)
    finish(true, null)
    return true
  } catch (error) {
    console.error(`Tâche ${name} en échec :`, error)
    finish(false, error instanceof Error ? error.message : String(error))
    return false
  }
}

/** La tâche est-elle à relancer : jamais passée, intervalle écoulé, ou délai après un échec. */
function isDue(db: Database, name: IngestJob) {
  const runs = db
    .query(
      'SELECT ok, finished_at FROM runs WHERE job = ? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 10',
    )
    .all(name) as { ok: number; finished_at: string }[]
  const last = runs[0]
  if (!last) return true
  const failures = runs.findIndex((run) => run.ok === 1)
  const streak = failures < 0 ? runs.length : failures
  const wait = streak ? Math.min(600_000 * 2 ** (streak - 1), 6 * HOUR) : INGEST_JOBS[name].every
  return Date.now() - Date.parse(last.finished_at) >= wait
}

const db = openData()
const [arg, dir] = process.argv.slice(2)
const legacy = process.env.LEGACY_PRICES

if (arg === '--loop') {
  if (readSource(db, 'catalog')) saveSnapshot(db, 'catalog', catalogSnapshot(db))
  saveSnapshot(db, 'prices', pricesSnapshot(db))
  if (legacy && !hasHistory(db) && existsSync(join(legacy, 'latest.json'))) {
    await importLegacyPrices(db, legacy)
  }
  // Les espèces sont enregistrées telles que les lit le code : repassées avec le code déployé.
  await runJob(db, 'species')
  for (;;) {
    for (const name of NAMES) {
      if (isDue(db, name)) await runJob(db, name)
    }
    await Bun.sleep(60_000)
  }
} else if (arg === 'legacy-prices' && dir) {
  await importLegacyPrices(db, dir)
} else if (NAMES.includes(arg as IngestJob)) {
  if (!(await runJob(db, arg as IngestJob))) process.exit(1)
} else {
  console.error(`Tâches : ${NAMES.join(', ')} ; ou --loop, ou legacy-prices <dossier>`)
  process.exit(1)
}
