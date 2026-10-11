/**
 * Prix Cardmarket des cartes de l'index, à lancer chaque jour (service `prices` de compose.yaml).
 * Télécharge le guide des prix public de Cardmarket pour Pokémon et garde les cartes de l'index,
 * reliées par leur identifiant Cardmarket (`cardmarket`, voir `scripts/cards.ts`). Écrit :
 * - `latest.json` : les prix du jour ;
 * - `history.json` : un prix par carte et par jour, pour les courbes (Cardmarket n'en garde pas).
 *
 *   bun scripts/prices.ts [dossier]      (défaut : public/prices, servi par `bun dev`)
 *
 * Sans dépendance ni alias : le service `prices` le lance avec Bun seul.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CardIndexFile, CardPrice, PriceFile, PriceHistoryFile } from '../src/types'

const PRICE_GUIDE_URL =
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json'

interface PriceGuide {
  createdAt: string
  priceGuides: {
    idProduct: number
    low: number | null
    trend: number | null
    avg30: number | null
  }[]
}

const outDir = process.argv[2] ?? join(import.meta.dirname, '..', 'public', 'prices')
const historyFile = join(outDir, 'history.json')

/** Un prix au centime ; Cardmarket note `0` ou `null` un prix inconnu. */
const amount = (value: number | null) => (value ? Math.round(value * 100) / 100 : null)

/** Écrit d'un coup : nginx ne sert jamais un fichier à moitié écrit. */
async function writeJson(file: string, data: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(data))
  await rename(`${file}.tmp`, file)
}

const index = JSON.parse(
  await readFile(join(import.meta.dirname, '..', 'src', 'data', 'card-index.json'), 'utf8'),
) as CardIndexFile
const guide = (await (await fetch(PRICE_GUIDE_URL)).json()) as PriceGuide
const byProduct = new Map(guide.priceGuides.map((row) => [row.idProduct, row]))

// Les prix du jour : la tendance Cardmarket, sinon sa moyenne sur 30 jours.
const cards: Record<string, CardPrice> = {}
for (const card of index.cards) {
  const row = card.cardmarket && byProduct.get(card.cardmarket)
  const price = row && (amount(row.trend) ?? amount(row.avg30))
  if (row && price) cards[card.id] = { price, low: amount(row.low), avg30: amount(row.avg30) }
}
const date = guide.createdAt.slice(0, 10)
await mkdir(outDir, { recursive: true })
await writeJson(join(outDir, 'latest.json'), { date, cards } satisfies PriceFile)

// L'historique : une colonne par jour ; relancé le même jour, le script remplace sa colonne.
const history: PriceHistoryFile = await readFile(historyFile, 'utf8')
  .then((text) => JSON.parse(text) as PriceHistoryFile)
  .catch(() => ({ days: [], cards: {} }))
if (!history.days.includes(date)) history.days.push(date)
const column = history.days.indexOf(date)
for (const id of new Set([...Object.keys(history.cards), ...Object.keys(cards)])) {
  const series = history.cards[id] ?? []
  while (series.length < history.days.length) series.push(null)
  series[column] = cards[id]?.price ?? null
  history.cards[id] = series
}
await writeJson(historyFile, history)

console.log(`Prix du ${date} : ${Object.keys(cards).length} cartes, ${history.days.length} jour(s)`)
