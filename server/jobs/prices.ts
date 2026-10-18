/**
 * Tâche `prices` : les prix des cartes à l'unité chez Cardmarket, regardés toutes les 6 h, d'après
 * son guide des prix public (prix du jour de chaque carte, par id produit) et sa liste des
 * produits (leur nom, leur extension et leur métacarte : `cardmarket_products`, d'où leur ligne
 * pour une liste de souhaits, `/api/wants`). Le prix du jour remplace celui de la veille
 * (`cardmarket_prices`) et s'ajoute à l'historique de la carte (`cardmarket_history`) ; relancée le
 * même jour, la tâche remplace le prix du jour. Le guide et la liste ne sont retéléchargés que si
 * le guide a changé depuis le dernier passage (`sources`, qui donne aussi leur ETag aux réponses
 * tirées des prix). L'API lit les prix des seules cartes demandées (`readPrices` :
 * `/api/prices/collection`, `/api/prices/selection`, le Pokédex public).
 */

import type { Database } from 'bun:sqlite'
import type { CardPriceRow, PriceFile } from '@/types'
import { readSource, writeSource } from '../db'
import { withPrice, yearDay } from '../history'
import { download } from '../lib/net'

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
  products: { idProduct: number; name: string; idExpansion: number; idMetacard: number }[]
}

/**
 * Enregistre la liste des produits : le nom, l'extension et la métacarte de chacun. Un produit
 * qu'elle ne donne plus garde son nom (son historique le montre) mais perd son extension : il ne
 * compte plus parmi les versions de sa carte (`wantsVersion`).
 */
function saveProducts(db: Database, { products }: ProductList) {
  // Seules les lignes qui changent sont réécrites : la liste compte plus de 70 000 produits.
  const write = db.query(
    `INSERT INTO cardmarket_products (id, name, expansion, metacard) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name, expansion = excluded.expansion, metacard = excluded.metacard
     WHERE name != excluded.name OR expansion IS NOT excluded.expansion
       OR metacard IS NOT excluded.metacard`,
  )
  for (const { idProduct, name, idExpansion, idMetacard } of products) {
    write.run(idProduct, name, idExpansion, idMetacard)
  }
  db.query(
    `UPDATE cardmarket_products SET expansion = NULL, metacard = NULL
     WHERE expansion IS NOT NULL AND id NOT IN (SELECT value FROM json_each(?))`,
  ).run(JSON.stringify(products.map(({ idProduct }) => idProduct)))
}

/** Un prix au centime ; Cardmarket note `0` ou `null` un prix inconnu. */
const amount = (value: number | null) => (value ? Math.round(value * 100) / 100 : null)

/**
 * Les prix Cardmarket du jour des cartes `ids`, d'après la base (une carte sans prix ce jour n'y
 * est pas) ; `null` tant que le guide n'a jamais été lu.
 */
export function readPrices(db: Database, ids: readonly number[]): PriceFile | null {
  const cardmarket = readSource(db, 'cardmarket')
  if (!cardmarket) return null
  const rows = db
    .query(
      `SELECT id, price, low, avg30 FROM cardmarket_prices
       WHERE id IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(ids)) as {
    id: number
    price: number
    low: number | null
    avg30: number | null
  }[]
  return {
    date: cardmarket.date,
    cards: Object.fromEntries(rows.map(({ id, price, low, avg30 }) => [id, [price, low, avg30]])),
  }
}

export async function prices(db: Database) {
  const head = await download(PRICE_GUIDE_URL, { method: 'HEAD' })
  const stamp = head.headers.get('last-modified') ?? ''
  if (stamp && stamp === readSource(db, 'cardmarket')?.stamp) {
    console.log('Cardmarket : guide des prix inchangé depuis le dernier passage.')
    return
  }

  const [guide, products] = await Promise.all([
    download(PRICE_GUIDE_URL).then((response) => response.json() as Promise<PriceGuide>),
    download(PRODUCTS_URL).then((response) => response.json() as Promise<ProductList>),
  ])
  const date = guide.createdAt.slice(0, 10)
  const [year, day] = yearDay(date)

  // Les prix du jour : la tendance Cardmarket, sinon sa moyenne sur 30 jours.
  const cards: [id: number, row: CardPriceRow][] = []
  for (const row of guide.priceGuides) {
    const price = row.idCategory === SINGLES && (amount(row.trend) ?? amount(row.avg30))
    if (price) cards.push([row.idProduct, [price, amount(row.low), amount(row.avg30)]])
  }

  // Moins de la moitié des prix d'avant : le format du guide a changé (un champ renommé). Rien
  // n'est écrit ; la tâche échoue, pour être relancée.
  const before = (
    db.query('SELECT COUNT(*) AS count FROM cardmarket_prices').get() as {
      count: number
    }
  ).count
  if (cards.length < before / 2) {
    throw new Error(`Guide des prix : ${cards.length} prix, contre ${before} (format changé ?)`)
  }

  const readYear = db.query(
    'SELECT first, prices FROM cardmarket_history WHERE id = ? AND year = ?',
  )
  const writeYear = db.query(
    `INSERT INTO cardmarket_history (id, year, first, prices) VALUES (?, ?, ?, ?)
     ON CONFLICT (id, year) DO UPDATE SET first = excluded.first, prices = excluded.prices`,
  )
  const writePrice = db.query(
    'INSERT INTO cardmarket_prices (id, price, low, avg30) VALUES (?, ?, ?, ?)',
  )
  let written = 0
  db.transaction(() => {
    saveProducts(db, products)
    db.run('DELETE FROM cardmarket_prices')
    for (const [id, [price, low, avg30]] of cards) {
      writePrice.run(id, price, low, avg30)
      const row = readYear.get(id, year) as { first: number; prices: string } | null
      const known = row ? { year, first: row.first, prices: JSON.parse(row.prices) } : undefined
      const next = withPrice(known, year, day, price)
      if (next === known) continue
      writeYear.run(id, year, next.first, JSON.stringify(next.prices))
      written++
    }
    writeSource(db, 'cardmarket', { stamp, date })
  })()

  console.log(
    `Cardmarket, prix du ${date} : ${cards.length} cartes, ${written} historiques mis à jour`,
  )
}
