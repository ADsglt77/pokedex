/**
 * Prix des cartes Pokémon à l'unité, à lancer chaque jour (service `prices` de compose.yaml).
 * Écrit, dans le dossier donné :
 * - `latest.json` : le prix du jour de chaque carte de Cardmarket, par id (`idProduct`), d'après son
 *   guide des prix public ;
 * - `history/<idProduct>.json` : son nom (liste des produits de Cardmarket) et un prix par jour,
 *   pour les courbes (Cardmarket n'en garde pas). L'app ne lit que ceux des cartes de
 *   l'utilisateur ;
 * - `tcgplayer.json` : pour les cartes du catalogue sans id Cardmarket (vieilles séries, decks que
 *   TCGdex ne relie pas à Cardmarket), le prix de leur produit TCGplayer (export de tcgcsv.com),
 *   converti en euros au cours de référence du jour de la Banque centrale européenne.
 * Chaque source n'est retéléchargée que si elle a changé depuis son dernier passage complet, que
 * date son fichier, écrit en dernier (le supprimer pour forcer un passage). Une source en échec
 * n'empêche pas l'autre ; le script finit alors en erreur, pour être relancé.
 *
 *   bun scripts/prices.ts [dossier]      (défaut : prices/, servi par `bun dev` à /prices/)
 *
 * Sans dépendance ni alias : le service `prices` le lance avec Bun seul (`scripts/` et `src/`).
 */

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { codeKey } from '../src/lib/card-code'
import type {
  CardPriceHistory,
  CardPriceRow,
  CatalogFile,
  PriceFile,
  TcgplayerPriceFile,
  TcgplayerPriceRow,
} from '../src/types'
import { mapPool, politeFetch } from './lib/net'

const DOWNLOADS = 'https://downloads.s3.cardmarket.com/productCatalog'
const PRICE_GUIDE_URL = `${DOWNLOADS}/priceGuide/price_guide_6.json`
const PRODUCTS_URL = `${DOWNLOADS}/productList/products_singles_6.json`
/** La catégorie des cartes à l'unité (« Pokémon Single ») ; les autres sont des produits scellés. */
const SINGLES = 51

const TCGCSV = 'https://tcgcsv.com'
/** La catégorie « Pokemon Japan » de TCGplayer. */
const TCGPLAYER_JAPAN = `${TCGCSV}/tcgplayer/85`
const ECB_RATES = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const CATALOG = join(import.meta.dirname, '..', 'src', 'data', 'catalog.json')

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

/** Le prix d'une impression d'un produit TCGplayer (normale, holo, 1re édition…), en dollars. */
interface TcgplayerPrice {
  productId: number
  lowPrice: number | null
  marketPrice: number | null
}

const outDir = process.argv[2] ?? join(import.meta.dirname, '..', 'prices')
const latestFile = join(outDir, 'latest.json')
const tcgplayerFile = join(outDir, 'tcgplayer.json')

/** Un prix au centime ; Cardmarket note `0` ou `null` un prix inconnu. */
const amount = (value: number | null) => (value ? Math.round(value * 100) / 100 : null)

async function download(url: string, init?: RequestInit) {
  const response = await politeFetch(url, init)
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`)
  return response
}

/** Écrit d'un coup : nginx ne sert jamais un fichier à moitié écrit. */
async function writeJson(file: string, data: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(data))
  await rename(`${file}.tmp`, file)
}

/** L'heure (ms) où un fichier a été écrit ; 0 s'il n'existe pas. */
const writtenAt = (file: string) =>
  stat(file).then(
    (found) => found.mtimeMs,
    () => 0,
  )

/** Un historique enregistré ; `null` s'il est illisible. */
function readHistory(text: string): CardPriceHistory | null {
  try {
    const history = JSON.parse(text) as CardPriceHistory
    return Array.isArray(history.prices) && !Number.isNaN(Date.parse(history.from)) ? history : null
  } catch {
    return null
  }
}

async function cardmarketPrices() {
  const head = await download(PRICE_GUIDE_URL, { method: 'HEAD' })
  if (Date.parse(head.headers.get('last-modified') ?? '') <= (await writtenAt(latestFile))) {
    return console.log('Cardmarket : guide des prix inchangé depuis le dernier passage.')
  }

  const [guide, catalog] = await Promise.all([
    download(PRICE_GUIDE_URL).then((response) => response.json() as Promise<PriceGuide>),
    download(PRODUCTS_URL).then((response) => response.json() as Promise<ProductList>),
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

  // L'historique de chaque carte : un prix par jour depuis `from` ; relancé le même jour, le script
  // remplace le prix du jour. Un historique illisible n'est jamais remplacé (par un vide) : il est
  // laissé tel quel et signalé, sans arrêter les autres.
  const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000
  let written = 0
  const unreadable: string[] = []
  await mapPool(Object.entries(cards), 32, async ([id, [price]]) => {
    const file = join(outDir, 'history', `${id}.json`)
    const text = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    const history: CardPriceHistory | null =
      text === null ? { name: null, from: date, prices: [] } : readHistory(text)
    if (!history) return void unreadable.push(id)
    const day = daysBetween(history.from, date)
    const name = history.name ?? names.get(Number(id)) ?? null
    if (day < 0 || (history.prices[day] === price && history.name === name)) return
    while (history.prices.length < day) history.prices.push(null)
    history.prices[day] = price
    await writeJson(file, { ...history, name })
    written++
  })

  // En dernier : il marque un passage complet (voir plus haut).
  await writeJson(latestFile, { date, cards } satisfies PriceFile)

  console.log(
    `Cardmarket, prix du ${date} : ${Object.keys(cards).length} cartes, ${written} historiques mis à jour`,
  )
  if (unreadable.length) {
    console.warn(
      `${unreadable.length} historiques illisibles, laissés tels quels : ${unreadable.slice(0, 20).join(', ')}`,
    )
  }
}

/** Dollars pour un euro, au cours de référence du jour de la Banque centrale européenne. */
async function usdPerEur() {
  const rates = await (await download(ECB_RATES)).text()
  const rate = Number(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/.exec(rates)?.[1])
  if (!(rate > 0)) throw new Error('Cours du dollar introuvable chez la BCE')
  return rate
}

async function tcgplayerPrices() {
  // tcgcsv publie l'export de TCGplayer une fois par jour ; le catalogue change quand on le refait.
  // Une date illisible compte pour un changement.
  const stamp = Date.parse(await (await download(`${TCGCSV}/last-updated.txt`)).text())
  const updated = Number.isNaN(stamp) ? Date.now() : stamp
  const lastRun = await writtenAt(tcgplayerFile)
  if (updated <= lastRun && (await writtenAt(CATALOG)) <= lastRun) {
    return console.log(
      'TCGplayer : ni ses prix ni le catalogue n’ont changé depuis le dernier passage.',
    )
  }

  // Les cartes du catalogue sans id Cardmarket, reliées à un produit TCGplayer : leur code (une
  // TAG TEAM est rangée sous chacun de ses Pokémon : une fois suffit), et les groupes où les lire.
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8')) as CatalogFile
  const codes = new Map<number, string>()
  const groups = new Set<number>()
  for (const rows of Object.values(catalog.cards)) {
    for (const [set, number, cardmarket, , product] of rows!) {
      if (cardmarket || !product) continue
      codes.set(product, codeKey({ set, number }))
      for (const group of catalog.sets[set]?.[2] ?? []) groups.add(group)
    }
  }

  const rate = await usdPerEur()
  const euros = (dollars: number | null) =>
    dollars ? Math.round((dollars / rate) * 100) / 100 : null
  const cards: Record<string, TcgplayerPriceRow> = {}
  for (const group of groups) {
    const { results } = (await (await download(`${TCGPLAYER_JAPAN}/${group}/prices`)).json()) as {
      results: TcgplayerPrice[]
    }
    // La moins chère des impressions de la carte (normale, holo, 1re édition…) : son prix du
    // marché, sinon son annonce la plus basse.
    for (const { productId, marketPrice, lowPrice } of results) {
      const code = codes.get(productId)
      const price = euros(marketPrice ?? lowPrice)
      if (!code || !price) continue
      const known = cards[code]
      if (!known || price < known[0]) cards[code] = [price, euros(lowPrice)]
    }
  }

  // En dernier : il marque un passage complet (voir plus haut).
  const date = new Date(updated).toISOString().slice(0, 10)
  await writeJson(tcgplayerFile, { date, usdPerEur: rate, cards } satisfies TcgplayerPriceFile)
  console.log(
    `TCGplayer, prix du ${date} : ${Object.keys(cards).length} cartes sur ${codes.size} sans id Cardmarket (1 € = ${rate} $)`,
  )
}

await mkdir(outDir, { recursive: true })
const failures = (await Promise.allSettled([cardmarketPrices(), tcgplayerPrices()])).filter(
  (result) => result.status === 'rejected',
)
for (const { reason } of failures) console.error(reason)
if (failures.length) process.exit(1)
