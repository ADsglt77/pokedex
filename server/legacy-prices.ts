/**
 * Reprise, une seule fois, des prix écrits par l'ancien service `prices` (retiré : des fichiers) dans
 * `data.db` : l'historique de chaque carte (irremplaçable : Cardmarket n'en garde pas) et les prix
 * du jour (pas ceux de TCGplayer, retiré). Le service `ingest` la fait de lui-même avant sa
 * première tâche, si la base n'a pas encore d'historique et que l'ancien dossier est là
 * (`LEGACY_PRICES`) ; en local : `bun run ingest legacy-prices ./prices`.
 *
 * Avant d'enregistrer, vérifie que rien ne s'est perdu : même nombre de cartes, même somme des
 * prix, et un échantillon relu tel que l'API le servira ; au moindre écart, rien n'est gardé.
 */

import type { Database } from 'bun:sqlite'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CardPriceHistory, PriceFile } from '@/types'
import { writeSource } from './db'
import { readHistory, splitYears } from './history'
import { pricesSnapshot } from './jobs/prices'
import { saveSnapshot } from './snapshots'

/** La somme de prix, en centimes : comparée exactement. */
const cents = (prices: (number | null)[]) =>
  prices.reduce<number>((sum, price) => sum + Math.round((price ?? 0) * 100), 0)

/** La base a-t-elle déjà un historique (repris, ou écrit par la tâche `prices`) ? */
export const hasHistory = (db: Database) =>
  db.query('SELECT 1 FROM cardmarket_history LIMIT 1').get() !== null

export async function importLegacyPrices(db: Database, dir: string) {
  if (hasHistory(db)) throw new Error('La base a déjà un historique : reprise refusée.')

  const readJson = async <T>(file: string): Promise<T | null> =>
    readFile(join(dir, file), 'utf8').then(
      (text) => JSON.parse(text) as T,
      () => null,
    )
  const latest = await readJson<PriceFile>('latest.json')
  const files = (await readdir(join(dir, 'history'))).filter((file) => file.endsWith('.json'))
  const histories = new Map<number, CardPriceHistory>()
  for (const file of files) {
    histories.set(Number(file.slice(0, -5)), (await readJson<CardPriceHistory>(`history/${file}`))!)
  }
  console.log(`${histories.size} historiques lus dans ${dir}`)

  const writeYear = db.query(
    'INSERT INTO cardmarket_history (id, year, first, prices) VALUES (?, ?, ?, ?)',
  )
  const writeName = db.query('INSERT OR REPLACE INTO cardmarket_products (id, name) VALUES (?, ?)')
  const writePrice = db.query(
    'INSERT INTO cardmarket_prices (id, price, low, avg30) VALUES (?, ?, ?, ?)',
  )

  db.transaction(() => {
    for (const [id, history] of histories) {
      for (const { year, first, prices } of splitYears(history)) {
        writeYear.run(id, year, first, JSON.stringify(prices))
      }
      if (history.name !== null) writeName.run(id, history.name)
    }
    if (latest) {
      db.run('DELETE FROM cardmarket_prices')
      for (const [id, [price, low, avg30]] of Object.entries(latest.cards)) {
        writePrice.run(Number(id), price, low, avg30)
      }
      // Sans date de mise à jour : la prochaine tâche `prices` relit le guide du jour.
      writeSource(db, 'cardmarket', { stamp: '', date: latest.date })
    }

    // Les vérifications, avant de valider : une erreur annule tout.
    const stored = db.query('SELECT COUNT(DISTINCT id) AS count FROM cardmarket_history').get() as {
      count: number
    }
    const expected = [...histories.values()].filter((history) =>
      history.prices.some((price) => price !== null),
    ).length
    if (stored.count !== expected) {
      throw new Error(`${stored.count} cartes en base pour ${expected} historiques avec un prix`)
    }
    const fileSum = [...histories.values()].reduce((sum, { prices }) => sum + cents(prices), 0)
    const rows = db.query('SELECT prices FROM cardmarket_history').all() as { prices: string }[]
    const baseSum = rows.reduce((sum, { prices }) => sum + cents(JSON.parse(prices)), 0)
    if (fileSum !== baseSum) throw new Error(`Somme des prix : ${baseSum} en base, ${fileSum} lus`)

    const ids = [...histories.keys()]
    for (let index = 0; index < Math.min(200, ids.length); index++) {
      const id = ids[Math.floor(Math.random() * ids.length)]!
      const file = histories.get(id)!
      const head = file.prices.findIndex((price) => price !== null)
      const last = file.prices.findLastIndex((price) => price !== null)
      const expectedHistory =
        head < 0
          ? null
          : {
              name: file.name,
              from: new Date(Date.parse(file.from) + head * 86_400_000).toISOString().slice(0, 10),
              prices: file.prices.slice(head, last + 1),
            }
      const read = readHistory(db, id)
      if (JSON.stringify(read) !== JSON.stringify(expectedHistory)) {
        throw new Error(`Historique ${id} relu différent : ${JSON.stringify(read)}`)
      }
    }
    console.log(
      `Vérifié : ${stored.count} cartes, ${(fileSum / 100).toFixed(2)} € de prix cumulés, 200 historiques relus à l'identique`,
    )
  })()

  saveSnapshot(db, 'prices', pricesSnapshot(db))
  console.log(
    `Repris : ${histories.size} historiques` +
      (latest ? `, prix Cardmarket du ${latest.date}` : ''),
  )
}
