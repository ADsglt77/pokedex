/**
 * Tâche `prices` : les prix des cartes à l'unité chez Cardmarket, regardés toutes les 6 h, d'après
 * son guide des prix public (prix du jour de chaque carte, par id produit) et sa liste des
 * produits (leurs noms). Le prix du jour remplace celui de la veille (`cardmarket_prices`) et
 * s'ajoute à l'historique de la carte (`cardmarket_history`) ; relancée le même jour, la tâche
 * remplace le prix du jour. Le guide n'est retéléchargé que s'il a changé depuis le dernier
 * passage (`sources`). En fin de tâche, la réponse de `/api/prices` est recalculée (`snapshots`).
 */

import type { Database } from 'bun:sqlite'
import type { CardPriceRow, Prices } from '@/types'
import { readSource, writeSource } from '../db'
import { withPrice, yearDay } from '../history'
import { download } from '../lib/net'
import { saveSnapshot } from '../snapshots'

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

/** Un prix au centime ; Cardmarket note `0` ou `null` un prix inconnu. */
const amount = (value: number | null) => (value ? Math.round(value * 100) / 100 : null)

/** Enregistre la réponse de `/api/prices` (les prix Cardmarket du jour), d'après la base. */
export function savePrices(db: Database) {
  const cardmarket = readSource(db, 'cardmarket')
  const rows = db.query('SELECT id, price, low, avg30 FROM cardmarket_prices').all() as {
    id: number
    price: number
    low: number | null
    avg30: number | null
  }[]
  const response: Prices = {
    cardmarket: cardmarket && {
      date: cardmarket.date,
      cards: Object.fromEntries(rows.map(({ id, price, low, avg30 }) => [id, [price, low, avg30]])),
    },
  }
  saveSnapshot(db, 'prices', response)
}

export async function prices(db: Database) {
  const head = await download(PRICE_GUIDE_URL, { method: 'HEAD' })
  const stamp = head.headers.get('last-modified') ?? ''
  if (stamp && stamp === readSource(db, 'cardmarket')?.stamp) {
    return console.log('Cardmarket : guide des prix inchangé depuis le dernier passage.')
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
  const writeName = db.query(
    `INSERT INTO cardmarket_products (id, name) VALUES (?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name WHERE name != excluded.name`,
  )
  let written = 0
  db.transaction(() => {
    for (const { idProduct, name } of products.products) writeName.run(idProduct, name)
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
  savePrices(db)
}
