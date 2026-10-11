/**
 * Prix Cardmarket des cartes de l'index, à lancer chaque jour (service `prices` de compose.yaml).
 * Télécharge le guide des prix public de Cardmarket pour Pokémon, garde les cartes de l'index
 * (reliées par `cardmarket`, voir `scripts/cards.ts`) et écrit dans le dossier donné :
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
const indexFile = join(import.meta.dirname, '..', 'src', 'data', 'card-index.json')

/** Un montant utilisable : positif, arrondi au centime. */
const amount = (value: unknown) =>
  typeof value === 'number' && value > 0 ? Math.round(value * 100) / 100 : null

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

/** Écrit d'un coup : nginx ne sert jamais un fichier à moitié écrit. */
async function writeJson(file: string, data: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(data))
  await rename(`${file}.tmp`, file)
}

async function download(): Promise<PriceGuide> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(PRICE_GUIDE_URL, {
        headers: { 'User-Agent': 'pokedex-perso/1.0 (prix quotidiens)' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return (await response.json()) as PriceGuide
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt))
    }
  }
}

const index = (await readJson<CardIndexFile>(indexFile))!
const guide = await download()
const byProduct = new Map(guide.priceGuides.map((row) => [row.idProduct, row]))

const cards: Record<string, CardPrice> = {}
for (const card of index.cards) {
  const row = card.cardmarket ? byProduct.get(card.cardmarket) : undefined
  const price = amount(row?.trend) ?? amount(row?.avg30)
  if (row && price) cards[card.id] = { price, low: amount(row.low), avg30: amount(row.avg30) }
}

const date = guide.createdAt.slice(0, 10)
await mkdir(outDir, { recursive: true })
await writeJson(join(outDir, 'latest.json'), { schemaVersion: 1, date, cards } satisfies PriceFile)

// Historique : une colonne par jour ; relancé le même jour, le script remplace sa colonne.
const historyFile = join(outDir, 'history.json')
const history = (await readJson<PriceHistoryFile>(historyFile)) ?? {
  schemaVersion: 1,
  days: [],
  cards: {},
}
if (!history.days.includes(date)) history.days.push(date)
const column = history.days.indexOf(date)
for (const id of new Set([...Object.keys(history.cards), ...Object.keys(cards)])) {
  const series = history.cards[id] ?? []
  while (series.length < history.days.length) series.push(null)
  series[column] = cards[id]?.price ?? null
  history.cards[id] = series
}
await writeJson(historyFile, history)

console.log(
  `Prix Cardmarket du ${date} : ${Object.keys(cards).length} cartes, historique de ${history.days.length} jour(s) → ${outDir}`,
)
