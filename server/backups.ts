/**
 * Les sauvegardes de `app.db` (les comptes et les collections, irremplaçables), faites par le
 * serveur lui-même : au démarrage puis chaque heure, celle du jour si elle manque,
 * `app-AAAA-MM-JJ.db` dans `BACKUP_DIR` (le volume `backups` sur le VPS, `.data/backups` en local) ;
 * 30 gardées. Faite par SQLite pendant que le serveur tourne (`VACUUM INTO` : une copie cohérente,
 * compacte), vérifiée (`PRAGMA quick_check`), puis mise à sa place d'un coup : une copie des
 * sauvegardes hors du VPS (README) qui passerait pendant l'écriture n'emporte jamais un fichier à
 * moitié écrit (celles en cours commencent par `tmp-`). Les données de référence ont les leurs,
 * dans l'API des données.
 */

import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { HOUR } from '@/lib/time'
import { DATA_DIR } from './db'
import { journal } from './journal'

const BACKUP_DIR = process.env.BACKUP_DIR ?? join(DATA_DIR, 'backups')

/** Les sauvegardes gardées : un mois. */
const KEPT = 30

/** La sauvegarde du jour, si elle manque. */
async function backup(app: Database) {
  const day = new Date().toISOString().slice(0, 10)
  const file = join(BACKUP_DIR, `app-${day}.db`)
  if (existsSync(file)) return
  await mkdir(BACKUP_DIR, { recursive: true })
  const temporary = join(BACKUP_DIR, `tmp-app-${day}.db`)
  try {
    await rm(temporary, { force: true })
    app.run(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`)
    const copy = new Database(temporary, { readonly: true })
    try {
      const { quick_check: result } = copy.query('PRAGMA quick_check').get() as {
        quick_check: string
      }
      if (result !== 'ok') throw new Error(`Copie abîmée : ${result}`)
    } finally {
      copy.close()
    }
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
  const kept = (await readdir(BACKUP_DIR)).filter((name) => /^app-.*\.db$/.test(name)).sort()
  for (const name of kept.slice(0, -KEPT)) await rm(join(BACKUP_DIR, name))
  journal({ topic: 'serveur', level: 'ok', message: 'Sauvegarde faite', details: { jour: day } })
}

/** Au démarrage, puis chaque heure : la sauvegarde du jour, si elle manque. Un échec au journal. */
export function scheduleBackups(app: Database) {
  const run = () =>
    backup(app).catch((error: unknown) =>
      journal({
        topic: 'serveur',
        level: 'error',
        message: 'Sauvegarde en échec',
        details: { raison: error instanceof Error ? error.message : String(error) },
      }),
    )
  void run()
  setInterval(run, HOUR)
}
