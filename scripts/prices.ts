/**
 * Prix Cardmarket de toutes les cartes Pokémon à l'unité, à lancer chaque jour (service `prices` de
 * compose.yaml). Télécharge le guide des prix public de Cardmarket et sa liste des produits (pour
 * le nom de chaque carte). Écrit, dans le dossier donné :
 * - `latest.json` : le prix du jour de chaque carte, par id Cardmarket (`idProduct`) ;
 * - `history/<idProduct>.json` : son nom et un prix par jour, pour les courbes (Cardmarket n'en
 *   garde pas). L'app ne lit que ceux des cartes de l'utilisateur.
 *
 *   bun scripts/prices.ts [dossier]      (défaut : prices/, servi par `bun dev` à /prices/)
 *
 * Sans dépendance ni alias : le service `prices` le lance avec Bun seul.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CardPriceHistory, CardPriceRow, PriceFile } from '../src/types'
import { mapPool } from './lib/net'

const DOWNLOADS = 'https://downloads.s3.cardmarket.com/productCatalog'
const PRICE_GUIDE_URL = `${DOWNLOADS}/priceGuide/price_guide_6.json`
const PRODUCTS_URL = `${DOWNLOADS}/productList/products_singles_6.json`
/** La catégorie des cartes à l'unité (« Pokémon Single ») ; les autres sont des produits scellés. */
const SINGLES = 51

interface PriceGuide {
  createdAt: string
  priceGuides: {
    idProduct: number
    idCategory: number
    low: number | null
    trend: number | null
    avg30: number | null
  }[]
}

interface ProductList {
  products: { idProduct: number; name: string }[]
}

const outDir = process.argv[2] ?? join(import.meta.dirname, '..', 'prices')

/** Un prix au centime ; Cardmarket note `0` ou `null` un prix inconnu. */
const amount = (value: number | null) => (value ? Math.round(value * 100) / 100 : null)

async function download<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`)
  return (await response.json()) as T
}

/** Écrit d'un coup : nginx ne sert jamais un fichier à moitié écrit. */
async function writeJson(file: string, data: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(data))
  await rename(`${file}.tmp`, file)
}

const [guide, catalog] = await Promise.all([
  download<PriceGuide>(PRICE_GUIDE_URL),
  download<ProductList>(PRODUCTS_URL),
])
const names = new Map(catalog.products.map(({ idProduct, name }) => [idProduct, name]))

// Les prix du jour : la tendance Cardmarket, sinon sa moyenne sur 30 jours.
const cards: Record<string, CardPriceRow> = {}
for (const row of guide.priceGuides) {
  const price = row.idCategory === SINGLES && (amount(row.trend) ?? amount(row.avg30))
  if (price) cards[row.idProduct] = [price, amount(row.low), amount(row.avg30)]
}
const date = guide.createdAt.slice(0, 10)
await mkdir(join(outDir, 'history'), { recursive: true })
await writeJson(join(outDir, 'latest.json'), { date, cards } satisfies PriceFile)

// L'historique de chaque carte : un prix par jour depuis `from` ; relancé le même jour, le script
// remplace le prix du jour. Un historique illisible arrête le script : il ne doit jamais être
// remplacé par un vide.
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000
let written = 0
await mapPool(Object.entries(cards), 32, async ([id, [price]]) => {
  const file = join(outDir, 'history', `${id}.json`)
  const history: CardPriceHistory = await readFile(file, 'utf8').then(
    (text) => JSON.parse(text) as CardPriceHistory,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return { name: null, from: date, prices: [] }
      throw error
    },
  )
  const day = daysBetween(history.from, date)
  const name = history.name ?? names.get(Number(id)) ?? null
  if (day < 0 || (history.prices[day] === price && history.name === name)) return
  while (history.prices.length < day) history.prices.push(null)
  history.prices[day] = price
  await writeJson(file, { ...history, name })
  written++
})

console.log(
  `Prix du ${date} : ${Object.keys(cards).length} cartes, ${written} historiques mis à jour`,
)
