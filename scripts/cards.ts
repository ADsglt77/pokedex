/**
 * Construit `src/data/card-index.json` : les cartes Pokémon japonaises de TCGdex qui ont une classe
 * de rareté, déjà classées, avec leur image et leur identifiant Cardmarket.
 *
 *   bun run data:cards [--refresh]
 *
 * 1. toutes les cartes Pokémon (GraphQL, par pages) ;
 * 2. la classe déduite des cartes secrètes sans rareté (`deduceSecrets.ts`) ;
 * 3. les cartes classées, sauf exclusions ;
 * 4. les images manquantes : chez TCGdex à l'adresse habituelle, sinon chez TCGplayer ;
 * 5. l'identifiant Cardmarket de chaque carte (REST, carte par carte).
 */

import { tcgdexImageBase } from '@/lib/images'
import type { CardIndexRow } from '@/types'
import { writeDataFile } from './lib/dataFile'
import { deduceSecrets } from './lib/deduceSecrets'
import { fetchJson, mapPool, urlExists } from './lib/net'
import { EXCLUDED_CARD_IDS, SECRET_CARD_RULES } from './lib/rules'
import { type Card, classify, readCard, type TcgdexCard } from './lib/tcgdex'
import { tcgplayerImages } from './lib/tcgplayer'

const GRAPHQL_URL = 'https://api.tcgdex.net/v2/graphql'
const REST_URL = 'https://api.tcgdex.net/v2/ja'
const PAGE_SIZE = 1000

interface TcgdexSet {
  name: string
  releaseDate?: string
  serie: { id: string }
  cardCount: { official: number }
  cards: { id: string; localId: string; name?: string }[]
}

const fetchSet = (id: string) =>
  fetchJson<TcgdexSet>(`${REST_URL}/sets/${encodeURIComponent(id)}`, 'tcgdex')

/**
 * Une page des cartes Pokémon. `rarity` est déclaré non nul alors qu'environ 5 % des cartes
 * japonaises n'en ont pas — justement des secrètes à classer : le demander ferait disparaître ces
 * cartes. Il est donc demandé dans une seconde sélection, où ces cartes valent `null`, et joint
 * par id.
 */
async function fetchPage(page: number): Promise<Card[]> {
  const args = `filters: {category: "Pokemon"}, pagination: {page: ${page}, itemsPerPage: ${PAGE_SIZE}}`
  const field = (fields: string) => `cards(${args}) @locale(lang: "ja") { ${fields} }`
  const query = `query { ${field('id localId name illustrator image dexId set { id }')} rarities: ${field('id rarity')} }`
  const { data } = await fetchJson<{
    data: { cards: TcgdexCard[]; rarities: (TcgdexCard | null)[] }
  }>(GRAPHQL_URL, 'tcgdex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const rarities = new Map(data.rarities.map((card) => [card?.id, card?.rarity]))
  return data.cards.map((card) => readCard({ ...card, rarity: rarities.get(card.id) }))
}

/** La classe déduite des cartes secrètes, extension par extension. Clé : id de la carte. */
async function deduceAll(cards: Card[]): Promise<Map<string, string>> {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const deduced = new Map<string, string>()
  for (const setId of Object.keys(SECRET_CARD_RULES)) {
    const set = await fetchSet(setId)
    // La règle lit toute l'extension, Dresseurs compris (ils ne sont pas dans `cards`).
    const setCards = set.cards.map((brief) => {
      const card = byId.get(brief.id)
      return {
        id: brief.id,
        number: brief.localId,
        name: card?.name ?? brief.name ?? null,
        isPokemon: card !== undefined,
        rarity: card?.rarity ?? null,
      }
    })
    for (const [id, code] of deduceSecrets(setId, set.cardCount.official, setCards)) {
      deduced.set(id, code)
    }
  }
  return deduced
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Numéros dans l'ordre des nombres, les numéros non numériques ensuite. */
function compareNumbers(a: string, b: string) {
  const [numericA, numericB] = [/^\d+$/.test(a), /^\d+$/.test(b)]
  if (numericA && numericB) return Number(a) - Number(b) || compareText(a, b)
  return numericA === numericB ? compareText(a, b) : numericA ? -1 : 1
}

// 1. Toutes les cartes Pokémon japonaises.
console.log('Lecture des cartes Pokémon japonaises de TCGdex…')
const cards: Card[] = []
for (let page = 1; ; page++) {
  const pageCards = await fetchPage(page)
  cards.push(...pageCards)
  if (pageCards.length < PAGE_SIZE) break
}

// 2 et 3. Les cartes classées.
const deduced = await deduceAll(cards)
const rows: CardIndexRow[] = cards.flatMap((card) => {
  const { code, deduced: isDeduced } = classify(card, deduced.get(card.id))
  if (!code || EXCLUDED_CARD_IDS.has(card.id) || card.dexIds.length === 0) return []
  return [{ ...card, rarity: code, ...(isDeduced && { deduced: true as const }) }]
})
console.log(`  ${cards.length} cartes, dont ${rows.length} classées`)

const setIds = [...new Set(rows.map((row) => row.set))]
const sets = new Map(await mapPool(setIds, 6, async (id) => [id, await fetchSet(id)] as const))

// 4. Les images manquantes.
const withoutImage = rows.filter((row) => !row.image)
await mapPool(withoutImage, 16, async (row) => {
  const base = tcgdexImageBase(sets.get(row.set)!.serie.id, row.set, row.number)
  if (await urlExists(`${base}/low.webp`, 'assets')) row.image = base
})
const tcgplayerImageOf = await tcgplayerImages(
  withoutImage.filter((row) => !row.image).map((row) => row.set),
)
for (const row of withoutImage) row.image ??= tcgplayerImageOf(row.set, row.number)
console.log(`  ${rows.filter((row) => !row.image).length} cartes sans image`)

// 5. L'identifiant Cardmarket, pour les prix (`scripts/prices.ts`).
await mapPool(rows, 8, async (row) => {
  const card = await fetchJson<{ pricing?: { cardmarket?: { idProduct: number } } }>(
    `${REST_URL}/cards/${encodeURIComponent(row.id)}`,
    'tcgdex',
  )
  const idProduct = card.pricing?.cardmarket?.idProduct
  if (idProduct) row.cardmarket = idProduct
})
console.log(`  ${rows.filter((row) => row.cardmarket).length} cartes reliées à Cardmarket`)

// Extension la plus ancienne d'abord (date inconnue à la fin), puis extension, numéro et id.
const releaseOf = (row: CardIndexRow) => sets.get(row.set)!.releaseDate ?? null
rows.sort((a, b) => {
  const [dateA, dateB] = [releaseOf(a), releaseOf(b)]
  if (dateA !== dateB) return dateA === null ? 1 : dateB === null ? -1 : compareText(dateA, dateB)
  return compareText(a.set, b.set) || compareNumbers(a.number, b.number) || compareText(a.id, b.id)
})

const indexSets: Record<string, { name: string; releaseDate: string | null }> = {}
for (const row of rows) {
  const set = sets.get(row.set)!
  indexSets[row.set] ??= { name: set.name, releaseDate: set.releaseDate ?? null }
}

await writeDataFile('card-index.json', (generatedAt) => ({
  generatedAt,
  sets: indexSets,
  cards: rows,
}))
