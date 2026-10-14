/**
 * Tâche `backups` : chaque jour, une copie des deux bases dans `BACKUP_DIR` (le volume `backups`
 * sur le VPS, `.data/backups` en local), faite par SQLite pendant que le serveur tourne
 * (`VACUUM INTO` : une copie cohérente, compacte) :
 * - `app-AAAA-MM-JJ.db` : le compte et la collection synchronisée, irremplaçables ; 30 gardées ;
 * - `data-AAAA-MM-JJ.db.gz` : les données de référence (compressées), dont l'historique des prix,
 *   irremplaçable aussi ; 7 gardées.
 * Le volume est sur le même disque que les bases : en copier le contenu ailleurs (README).
 * Restaurer : arrêter `server` et `ingest`, remettre le fichier à la place de la base (sans ses
 * `-wal` et `-shm`), redémarrer.
 */

import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../db'

const BACKUP_DIR = process.env.BACKUP_DIR ?? join(DATA_DIR, 'backups')

/** Copie une base, ouverte en lecture seule ; une copie du même jour est remplacée. */
async function copy(name: string, file: string) {
  await rm(file, { force: true })
  const db = new Database(join(DATA_DIR, name), { readonly: true })
  try {
    db.run(`VACUUM INTO '${file.replaceAll("'", "''")}'`)
  } finally {
    db.close()
  }
}

/** Ne garde que les `count` copies les plus récentes de ce préfixe (leur nom porte leur jour). */
async function prune(prefix: string, count: number) {
  const files = (await readdir(BACKUP_DIR)).filter((file) => file.startsWith(prefix)).sort()
  for (const file of files.slice(0, -count)) await rm(join(BACKUP_DIR, file))
}

export async function backups() {
  const day = new Date().toISOString().slice(0, 10)
  await mkdir(BACKUP_DIR, { recursive: true })

  // Sans `app.db`, le serveur n'a jamais démarré : rien à sauvegarder.
  if (existsSync(join(DATA_DIR, 'app.db'))) {
    await copy('app.db', join(BACKUP_DIR, `app-${day}.db`))
    await prune('app-', 30)
  }

  const plain = join(BACKUP_DIR, `data-${day}.db`)
  await copy('data.db', plain)
  await writeFile(`${plain}.gz`, Bun.gzipSync(await readFile(plain)))
  await rm(plain)
  await prune('data-', 7)
  console.log(`Sauvegardes du ${day} dans ${BACKUP_DIR}`)
}
