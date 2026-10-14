/**
 * Tâche `prices` : les prix des cartes à l'unité, regardés toutes les 6 h.
 * - Cardmarket : son guide des prix public (prix du jour de chaque carte, par id produit) et sa
 *   liste des produits (leurs noms). Le prix du jour remplace celui de la veille
 *   (`cardmarket_prices`) et s'ajoute à l'historique de la carte (`cardmarket_history`) ; relancé
 *   le même jour, il remplace le prix du jour.
 * - TCGplayer (export de tcgcsv.com) : pour les cartes du catalogue sans prix Cardmarket ce jour
 *   (sans id : vieilles séries, decks ; ou dont l'id n'a pas de prix dans le guide : promos…), le
 *   prix de leur produit TCGplayer, converti en euros au cours du jour de la BCE.
 * Chaque source n'est retéléchargée que si elle a changé depuis son dernier passage (`sources`) ;
 * TCGplayer aussi quand le catalogue ou les prix Cardmarket ont changé. Une source en échec
 * n'empêche pas l'autre ; la tâche échoue alors, pour être relancée. En fin de tâche, la réponse
 * de `/api/prices` est recalculée (`snapshots`).
 */

import type { Database } from 'bun:sqlite'
import { codeKey } from '@/lib/card-code'
import type { CardPriceRow, Prices, TcgplayerPriceRow } from '@/types'
import { readSource, writeSource } from '../db'
import { withPrice, yearDay } from '../history'
import { politeFetch } from '../lib/net'
import { saveSnapshot } from '../snapshots'

const DOWNLOADS = 'https://downloads.s3.cardmarket.com/productCatalog'
const PRICE_GUIDE_URL = `${DOWNLOADS}/priceGuide/price_guide_6.json`
const PRODUCTS_URL = `${DOWNLOADS}/productList/products_singles_6.json`
/** La catégorie des cartes à l'unité (« Pokémon Single ») ; les autres sont des produits scellés. */
const SINGLES = 51

const TCGCSV = 'https://tcgcsv.com'
/** La catégorie « Pokemon Japan » de TCGplayer. */
const TCGPLAYER_JAPAN = `${TCGCSV}/tcgplayer/85`
const ECB_RATES = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

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

/** Un prix au centime ; Cardmarket note `0` ou `null` un prix inconnu. */
const amount = (value: number | null) => (value ? Math.round(value * 100) / 100 : null)

async function download(url: string, init?: RequestInit) {
  const response = await politeFetch(url, init)
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`)
  return response
}

async function cardmarketPrices(db: Database) {
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
      const known = row && { year, first: row.first, prices: JSON.parse(row.prices) }
      const next = known ? withPrice(known, day, price) : { year, first: day, prices: [price] }
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

/** Dollars pour un euro, au cours de référence du jour de la Banque centrale européenne. */
async function usdPerEur() {
  const rates = await (await download(ECB_RATES)).text()
  const rate = Number(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/.exec(rates)?.[1])
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(rates)?.[1]
  if (!(rate > 0) || !date) throw new Error('Cours du dollar introuvable chez la BCE')
  return { rate, date }
}

async function tcgplayerPrices(db: Database) {
  // tcgcsv publie l'export de TCGplayer une fois par jour ; le catalogue change avec la tâche
  // `catalog`, les prix Cardmarket avec leur guide.
  // Sans catalogue (encore jamais construit), aucune carte à chiffrer : les prix d'avant restent.
  const catalog = readSource(db, 'catalog')
  if (!catalog) return console.log('TCGplayer : pas encore de catalogue.')
  const updated = (await (await download(`${TCGCSV}/last-updated.txt`)).text()).trim()
  const stamp = [updated, catalog.stamp, readSource(db, 'cardmarket')?.stamp ?? ''].join(' | ')
  if (stamp === readSource(db, 'tcgplayer')?.stamp) {
    return console.log(
      'TCGplayer : ni ses prix, ni le catalogue, ni ceux de Cardmarket n’ont changé depuis le dernier passage.',
    )
  }

  // Les cartes du catalogue sans prix Cardmarket ce jour (sans id, ou un id absent du guide),
  // reliées à un produit TCGplayer : leur code, et les groupes où les lire.
  const rows = db
    .query(
      `SELECT cards.set_id AS 'set', cards.number, cards.tcgplayer AS product,
              sets.tcgplayer_groups AS groups
       FROM cards JOIN sets ON sets.id = cards.set_id
       LEFT JOIN cardmarket_prices ON cardmarket_prices.id = cards.cardmarket
       WHERE cards.tcgplayer != 0 AND cardmarket_prices.id IS NULL`,
    )
    .all() as { set: string; number: string; product: number; groups: string }[]
  const codes = new Map<number, string>()
  const ambiguous = new Set<number>()
  const groups = new Set<number>()
  for (const { set, number, product, groups: setGroups } of rows) {
    const code = codeKey({ set, number })
    if (codes.has(product) && codes.get(product) !== code) ambiguous.add(product)
    codes.set(product, code)
    for (const group of JSON.parse(setGroups) as number[]) groups.add(group)
  }
  // Le catalogue ne donne un produit qu'à une carte : sinon, le prix irait à la dernière.
  if (ambiguous.size) {
    console.warn(
      `TCGplayer : ${ambiguous.size} produits reliés à plusieurs cartes (${[...ambiguous].slice(0, 10).join(', ')})`,
    )
  }

  const { rate, date: rateDate } = await usdPerEur()
  const euros = (dollars: number | null) =>
    dollars ? Math.round((dollars / rate) * 100) / 100 : null
  const cards = new Map<string, TcgplayerPriceRow>()
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
      const known = cards.get(code)
      if (!known || price < known[0]) cards.set(code, [price, euros(lowPrice)])
    }
  }

  // Une date illisible : celle du cours de la BCE.
  const parsed = Date.parse(updated)
  const date = Number.isNaN(parsed) ? rateDate : new Date(parsed).toISOString().slice(0, 10)
  const writePrice = db.query('INSERT INTO tcgplayer_prices (code, price, low) VALUES (?, ?, ?)')
  db.transaction(() => {
    db.run('DELETE FROM tcgplayer_prices')
    for (const [code, [price, low]] of cards) writePrice.run(code, price, low)
    db.query(
      `INSERT INTO rates (date, usd_per_eur) VALUES (?, ?)
       ON CONFLICT (date) DO UPDATE SET usd_per_eur = excluded.usd_per_eur`,
    ).run(rateDate, rate)
    writeSource(db, 'tcgplayer', { stamp, date })
  })()
  console.log(
    `TCGplayer, prix du ${date} : ${cards.size} cartes sur ${codes.size} sans prix Cardmarket (1 € = ${rate} $)`,
  )
}

/** La réponse de `/api/prices` : les deux fichiers de prix d'avant, en un. */
export function pricesSnapshot(db: Database): Prices {
  const cardmarket = readSource(db, 'cardmarket')
  const tcgplayer = readSource(db, 'tcgplayer')
  const rate = db.query('SELECT usd_per_eur FROM rates ORDER BY date DESC LIMIT 1').get() as {
    usd_per_eur: number
  } | null
  const cardmarketRows = db.query('SELECT id, price, low, avg30 FROM cardmarket_prices').all() as {
    id: number
    price: number
    low: number | null
    avg30: number | null
  }[]
  const tcgplayerRows = db.query('SELECT code, price, low FROM tcgplayer_prices').all() as {
    code: string
    price: number
    low: number | null
  }[]
  return {
    cardmarket: cardmarket && {
      date: cardmarket.date,
      cards: Object.fromEntries(
        cardmarketRows.map(({ id, price, low, avg30 }) => [id, [price, low, avg30]]),
      ),
    },
    tcgplayer: tcgplayer &&
      rate && {
        date: tcgplayer.date,
        usdPerEur: rate.usd_per_eur,
        cards: Object.fromEntries(
          tcgplayerRows.map(({ code, price, low }) => [code, [price, low]]),
        ),
      },
  }
}

export async function prices(db: Database) {
  // Cardmarket d'abord : TCGplayer complète les cartes qu'il ne chiffre pas.
  const errors: unknown[] = []
  for (const source of [cardmarketPrices, tcgplayerPrices]) {
    await source(db).catch((error: unknown) => errors.push(error))
  }
  saveSnapshot(db, 'prices', pricesSnapshot(db))
  if (errors.length) throw new AggregateError(errors, 'Une source de prix a échoué')
}
