/**
 * Construit `src/data/card-index.json` : toutes les cartes Pokémon japonaises de TCGdex qui
 * appartiennent à une classe de rareté (`src/config/rarities.ts`). La grille du Pokédex montre
 * ainsi une vraie carte pour chaque espèce sans aucune requête.
 *
 *   bun run data:cards [--refresh]
 */

import { EXCLUDED_CARD_IDS, RARITY_CLASSES, SECRET_CARD_RULES } from '@/config/rarities'
import { classifyCard, tcgdexIdOf } from '@/lib/rarity'
import { guessImageBase, normalizeTcgdexCard, type TcgdexRawCard } from '@/lib/tcgdex'
import type { CardIndexFile, CardIndexRow, PokemonCard } from '@/types'
import { writeDataFile } from './lib/dataFile'
import { deduceSecrets } from './lib/deduceSecrets'
import { fetchJson, mapPool, NotFoundError, urlExists } from './lib/net'
import { tcgplayerImages } from './lib/tcgplayer'

const GRAPHQL_URL = 'https://api.tcgdex.net/v2/graphql'
const REST_URL = 'https://api.tcgdex.net/v2/ja'
const PAGE_SIZE = 1000

interface RawSet {
  name?: string
  releaseDate?: string
  serie?: { id?: string }
  cardCount?: { official?: number }
  cards?: { id: string; localId: string; name?: string }[]
}

type GraphqlCards = { data?: Record<'cards' | 'rarities', (TcgdexRawCard | null)[] | undefined> }

const fetchSet = (id: string) =>
  fetchJson<RawSet>(`${REST_URL}/sets/${encodeURIComponent(id)}`, 'tcgdex')

/**
 * Une page des cartes Pokémon. `rarity` est déclaré non nul alors qu'environ 5 % des cartes
 * japonaises n'en ont pas — justement des secrètes dont la classe est déduite : le demander
 * ferait disparaître ces cartes. Il est donc demandé dans une seconde sélection, jointe par id.
 */
async function fetchPage(page: number) {
  const args = `filters: {category: "Pokemon"}, pagination: {page: ${page}, itemsPerPage: ${PAGE_SIZE}}`
  const field = (fields: string) => `cards(${args}) @locale(lang: "ja") { ${fields} }`
  const query = `query { ${field('id localId name illustrator image dexId category set { id name }')} rarities: ${field('id rarity')} }`
  const { data } = await fetchJson<GraphqlCards>(GRAPHQL_URL, 'tcgdex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!data?.cards) throw new Error(`La page ${page} de TCGdex ne contient pas de cartes.`)

  const rarities = new Map(data.rarities?.map((card) => [card?.id, card?.rarity]))
  const cards = data.cards.flatMap((raw) =>
    raw ? (normalizeTcgdexCard({ ...raw, rarity: rarities.get(raw.id) ?? null }) ?? []) : [],
  )
  return { cards, last: data.cards.length < PAGE_SIZE }
}

/** Les cartes secrètes de chaque extension de `SECRET_CARD_RULES` reçoivent leur classe déduite. */
async function withDeducedClasses(cards: PokemonCard[]): Promise<PokemonCard[]> {
  const byId = new Map(cards.map((card) => [tcgdexIdOf(card), card]))
  const hints = new Map<string, string>()

  for (const setId of Object.keys(SECRET_CARD_RULES)) {
    const set = await fetchSet(setId).catch((error: unknown) => {
      if (error instanceof NotFoundError) return console.warn(`  Extension ${setId} inconnue.`)
      throw error
    })
    if (!set) continue
    const officialCount = set.cardCount?.official ?? null
    if (officialCount !== SECRET_CARD_RULES[setId]!.officialCount) {
      console.warn(`  ${setId} : compte officiel ${officialCount} ≠ règle, rien n'est déduit.`)
    }
    // La règle a besoin de toute l'extension, Dresseurs compris.
    const setCards = (set.cards ?? []).map((brief) => {
      const card = byId.get(brief.id)
      return {
        id: brief.id,
        number: brief.localId,
        name: card?.name ?? brief.name ?? null,
        isPokemon: card !== undefined,
        rarity: card?.rarity ?? null,
      }
    })
    for (const [id, code] of deduceSecrets(setId, officialCount, setCards)) hints.set(id, code)
  }

  console.log(`  ${hints.size} cartes secrètes classées par déduction`)
  return cards.map((card) => {
    const rarityHint = hints.get(tcgdexIdOf(card) ?? '')
    return rarityHint ? { ...card, rarityHint } : card
  })
}

function toRow(card: PokemonCard): CardIndexRow | null {
  const id = tcgdexIdOf(card)
  if (!id || !card.set?.id || !card.number) return null
  return {
    id,
    set: card.set.id,
    number: card.number,
    name: card.name ?? '',
    rarity: card.rarity ?? '',
    ...(card.rarityHint ? { rarityHint: card.rarityHint } : {}),
    illustrator: card.illustrator,
    image: card.image?.small.replace(/\/low\.webp$/, '') ?? null,
    dexIds: card.dexIds,
  }
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Numéros numériques dans l'ordre des nombres, avant les autres. */
function compareNumbers(a: string, b: string) {
  const [numericA, numericB] = [/^\d+$/.test(a), /^\d+$/.test(b)]
  if (numericA && numericB) return Number(a) - Number(b) || compareText(a, b)
  return numericA === numericB ? compareText(a, b) : numericA ? -1 : 1
}

console.log('Lecture des cartes Pokémon japonaises de TCGdex…')
const crawled: PokemonCard[] = []
for (let page = 1; ; page++) {
  const { cards, last } = await fetchPage(page)
  crawled.push(...cards)
  if (last) break
}
console.log(`  ${crawled.length} cartes`)

const selected = (await withDeducedClasses(crawled)).filter(
  (card) =>
    classifyCard(card).rarityClass !== null &&
    !EXCLUDED_CARD_IDS.has(tcgdexIdOf(card) ?? '') &&
    card.dexIds.length > 0,
)

const setIds = [...new Set(selected.flatMap((card) => card.set?.id ?? []))]
console.log(`Lecture de ${setIds.length} extensions…`)
const setInfo = new Map(
  await mapPool(setIds, 6, async (id) => {
    const set = await fetchSet(id)
    const releaseDate = set.releaseDate?.trim() ?? ''
    const fallbackName = selected.find((card) => card.set?.id === id)?.set?.name ?? ''
    return [
      id,
      {
        name: set.name?.trim() || fallbackName,
        serieId: set.serie?.id?.trim() || null,
        releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? releaseDate : null,
      },
    ] as const
  }),
)

const rows = selected.flatMap((card) => toRow(card) ?? [])

// Images manquantes, dans l'ordre : celle que TCGdex publie sans la référencer dans son API
// (vérifiée à l'adresse habituelle), sinon celle du catalogue TCGplayer (plus petite).
const withoutImage = rows.filter((row) => row.image === null)
console.log(`Recherche des images de ${withoutImage.length} cartes sans image dans l'API TCGdex…`)
await mapPool(withoutImage, 16, async (row) => {
  const serieId = setInfo.get(row.set)?.serieId
  if (!serieId) return
  const base = guessImageBase(serieId, row.set, row.number)
  if (await urlExists(`${base}/low.webp`, 'assets')) row.image = base
})
const stillMissing = withoutImage.filter((row) => row.image === null)
console.log(`  ${withoutImage.length - stillMissing.length} trouvées chez TCGdex`)

const tcgplayerImageOf = await tcgplayerImages(stillMissing.map((row) => row.set))
for (const row of stillMissing) row.image = tcgplayerImageOf(row.set, row.number)
const noImage = rows.filter((row) => row.image === null)
console.log(`  ${stillMissing.length - noImage.length} trouvées chez TCGplayer`)
if (noImage.length > 0) console.log(`  sans image : ${noImage.map((row) => row.id).join(', ')}`)

const releaseOf = (row: CardIndexRow) => setInfo.get(row.set)?.releaseDate ?? null
// Extension la plus ancienne d'abord (dates inconnues à la fin), puis extension, numéro et id.
rows.sort((a, b) => {
  const [dateA, dateB] = [releaseOf(a), releaseOf(b)]
  if (dateA !== dateB) return dateA === null ? 1 : dateB === null ? -1 : compareText(dateA, dateB)
  return compareText(a.set, b.set) || compareNumbers(a.number, b.number) || compareText(a.id, b.id)
})

const sets: CardIndexFile['sets'] = {}
for (const row of rows) sets[row.set] ??= setInfo.get(row.set)!

console.log(`${rows.length} cartes dans l'index, ${Object.keys(sets).length} extensions`)
await writeDataFile('card-index.json', (generatedAt) => ({
  schemaVersion: 1,
  generatedAt,
  source: `TCGdex (${REST_URL}), images complétées par TCGplayer (tcgcsv.com)`,
  rarities: RARITY_CLASSES.flatMap((rarityClass) => rarityClass.aliases),
  sets,
  cards: rows,
}))
