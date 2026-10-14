/**
 * Les tâches d'ingestion : chacune lit une ou plusieurs sources et écrit dans `data.db`.
 *
 *   bun server/ingest.ts <tâche>     une tâche, tout de suite (`bun run ingest catalog`)
 *   bun server/ingest.ts --loop      service `ingest` : chaque tâche à son rythme
 *   bun server/ingest.ts legacy-prices <dossier>   reprise des anciens fichiers de prix
 *
 * En boucle, au démarrage : les réponses calculées de l'API (`snapshots`) sont refaites (leur
 * forme a pu changer avec le code déployé), et la reprise des anciens fichiers de prix
 * (`LEGACY_PRICES`, `legacy-prices.ts`) passe d'abord, si la base n'a pas encore d'historique :
 * la tâche `prices` n'écrit qu'ensuite.
 * En boucle, une tâche repart quand sa dernière réussite a plus que son intervalle ; après un
 * échec (source indisponible…), 10 min plus tard, puis 20, 40… jusqu'à 6 h : une panne qui dure
 * ne fait pas solliciter la source toutes les 10 min. Chaque passage est noté dans `runs`
 * (lu par `/api/status`).
 */

import type { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { openData, readSource } from './db'
import { backups } from './jobs/backups'
import { catalog, catalogSnapshot } from './jobs/catalog'
import { images } from './jobs/images'
import { prices, pricesSnapshot } from './jobs/prices'
import { hasHistory, importLegacyPrices } from './legacy-prices'
import { saveSnapshot } from './snapshots'

const HOUR = 3_600_000

// Dans l'ordre où elles passent : les prix TCGplayer et les images suivent le catalogue.
const JOBS: Record<string, { every: number; run: (db: Database) => Promise<void> }> = {
  // De nouvelles cartes quelques fois par mois.
  catalog: { every: 24 * HOUR, run: catalog },
  // Les prix changent une fois par jour ; la tâche ne retélécharge que ce qui a changé.
  prices: { every: 6 * HOUR, run: prices },
  // Après les prix : son premier passage (environ 1 Go) est long.
  images: { every: 24 * HOUR, run: images },
  // Les deux bases, copiées chaque jour (`BACKUP_DIR`).
  backups: { every: 24 * HOUR, run: backups },
}

async function runJob(db: Database, name: string) {
  const job = JOBS[name]!
  const now = () => new Date().toISOString()
  const { id } = db
    .query('INSERT INTO runs (job, started_at) VALUES (?, ?) RETURNING id')
    .get(name, now()) as { id: number }
  const finish = (ok: boolean, message: string | null) =>
    db
      .query('UPDATE runs SET finished_at = ?, ok = ?, message = ? WHERE id = ?')
      .run(now(), ok ? 1 : 0, message, id)
  try {
    await job.run(db)
    finish(true, null)
    return true
  } catch (error) {
    console.error(`Tâche ${name} en échec :`, error)
    finish(false, error instanceof Error ? error.message : String(error))
    return false
  }
}

/** La tâche est-elle à relancer : jamais passée, intervalle écoulé, ou délai après un échec. */
function isDue(db: Database, name: string) {
  const runs = db
    .query(
      'SELECT ok, finished_at FROM runs WHERE job = ? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 10',
    )
    .all(name) as { ok: number; finished_at: string }[]
  const last = runs[0]
  if (!last) return true
  const failures = runs.findIndex((run) => run.ok === 1)
  const streak = failures < 0 ? runs.length : failures
  const wait = streak ? Math.min(600_000 * 2 ** (streak - 1), 6 * HOUR) : JOBS[name]!.every
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
  for (;;) {
    for (const name of Object.keys(JOBS)) {
      if (isDue(db, name)) await runJob(db, name)
    }
    await Bun.sleep(60_000)
  }
} else if (arg === 'legacy-prices' && dir) {
  await importLegacyPrices(db, dir)
} else if (arg && arg in JOBS) {
  if (!(await runJob(db, arg))) process.exit(1)
} else {
  console.error(`Tâches : ${Object.keys(JOBS).join(', ')} ; ou --loop, ou legacy-prices <dossier>`)
  process.exit(1)
}
