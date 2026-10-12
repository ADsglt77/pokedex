/**
 * Construit `src/data/card-index.json` : les pleines cartes Pokémon japonaises, avec leur classe,
 * leur image et leur identifiant Cardmarket.
 *
 *   bun run data:cards [--refresh]
 *
 * La liste et la classe viennent du catalogue TCGplayer (`lib/tcgplayer.ts`) : sa rareté suit le
 * code imprimé sur la carte. TCGdex (`lib/tcgdex.ts`) complète chaque carte qu'il a : nom
 * japonais, illustrateur, image, Pokémon et id Cardmarket. Ce que les deux disent mal, ou ne
 * disent pas : `lib/rules.ts`.
 */

import { TOTAL_SPECIES } from '@/config/pokedex'
import { cardImage, tcgplayerImageBase } from '@/lib/images'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CardIndexFile, CardIndexRow } from '@/types'
import { writeDataFile } from './lib/dataFile'
import { mapPool, urlExists } from './lib/net'
import {
  DEX_ID_CORRECTIONS,
  FULL_ART_PROMO_IDS,
  isWindowedGold,
  TCGPLAYER_SETS,
  WRONG_TCGDEX_IMAGES,
} from './lib/rules'
import { speciesInName } from './lib/species'
import {
  cardmarketId,
  type TcgdexCard,
  tcgdexCards,
  tcgdexImageBase,
  tcgdexSet,
  tcgdexSetIds,
} from './lib/tcgdex'
import { type CatalogCard, catalogCards, catalogGroups } from './lib/tcgplayer'

/** `017` et `17` désignent la même carte. */
const numberKey = (number: string) => (/^\d+$/.test(number) ? String(Number(number)) : number)

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

interface Found {
  row: CardIndexRow
  card: CatalogCard
  /** La carte chez TCGdex, s'il l'a. */
  known: TcgdexCard | undefined
}

console.log('Lecture de TCGdex et du catalogue TCGplayer…')
const tcgdex = new Map(
  (await tcgdexCards()).map((card) => [`${card.set.id}#${numberKey(card.localId)}`, card]),
)
const tcgdexSets = new Set(await tcgdexSetIds())

/** Une pleine carte du catalogue → une ligne de l'index ; `null` pour toute autre carte. */
function toRow(setId: string, card: CatalogCard, known: TcgdexCard | undefined): Found | null {
  const id = known?.id ?? `${setId}-${card.number}`
  const rarity = FULL_ART_PROMO_IDS.has(id) ? 'PR' : card.code
  if (!rarity || isWindowedGold(setId, rarity) || !(known || card.isPokemon)) return null
  // Les Pokémon : ceux de TCGdex, sinon ceux lus dans le nom japonais, sinon dans le nom anglais.
  const dexIds =
    DEX_ID_CORRECTIONS[id] ??
    (known?.dexId?.length
      ? known.dexId
      : speciesInName(known?.name ?? card.name, known?.name ? 'ja' : 'en'))
  const row: CardIndexRow = {
    id,
    set: setId,
    number: known?.localId ?? card.number,
    name: known?.name?.trim() || null,
    rarity,
    illustrator: known?.illustrator?.trim() || null,
    image: known?.image ?? null,
    dexIds: [...new Set(dexIds)].filter((dexId) => dexId >= 1 && dexId <= TOTAL_SPECIES),
  }
  return row.dexIds.length ? { row, card, known } : null
}

// 1. Les pleines cartes, extension par extension. Celles que TCGdex a saisies d'abord : son
// « SM1+ » vide double « SM1p », et un groupe TCGplayer ne sert qu'une fois. Puis ses extensions
// vides, puis celles qu'il n'a pas.
const filled = new Set([...tcgdex.values()].map((card) => card.set.id))
const setIds = new Set([
  ...[...tcgdexSets].sort((a, b) => Number(filled.has(b)) - Number(filled.has(a))),
  ...Object.keys(TCGPLAYER_SETS),
])
const usedGroups = new Set<number>()
const published = new Map<string, string>()
const found: Found[] = []
const absent: string[] = []
for (const setId of setIds) {
  const groups = await catalogGroups(setId)
  if (groups.length === 0 && filled.has(setId)) absent.push(setId)
  for (const group of groups) {
    if (usedGroups.has(group.groupId)) continue
    usedGroups.add(group.groupId)
    // Une extension répartie sur plusieurs groupes prend la date du premier.
    if (!published.has(setId)) published.set(setId, group.publishedOn.slice(0, 10))
    for (const card of await catalogCards(group)) {
      const entry = toRow(setId, card, tcgdex.get(`${setId}#${numberKey(card.number)}`))
      if (entry) found.push(entry)
    }
  }
}
// Les vieilles extensions (1996-2009) n'ont ni groupe TCGplayer ni pleine carte.
console.log(`  ${absent.length} extensions de TCGdex absentes de TCGplayer : ${absent.join(', ')}`)
const rows = found.map(({ row }) => row)
console.log(
  `  ${rows.length} pleines cartes, dont ${found.filter((f) => f.known).length} chez TCGdex`,
)

// 2. Les extensions : nom et date chez TCGdex, sinon dans `TCGPLAYER_SETS` et chez TCGplayer.
const usedSetIds = [...new Set(rows.map((row) => row.set))]
const sets = new Map(
  await mapPool(usedSetIds, 6, async (id) => {
    const set = tcgdexSets.has(id) ? await tcgdexSet(id) : null
    const info = {
      name: TCGPLAYER_SETS[id]?.name ?? set!.name,
      releaseDate: set?.releaseDate ?? published.get(id)!,
      serie: set?.serie.id,
    }
    return [id, info] as const
  }),
)

// 3. Les images : celle de TCGdex ; sinon celle qu'il range sans la citer, à l'adresse habituelle ;
// sinon celle de TCGplayer, s'il en a une (sans image, l'app montre une carte de substitution).
await mapPool(found, 16, async ({ row, card, known }) => {
  if (row.image) return
  if (known && !WRONG_TCGDEX_IMAGES.has(row.set) && !WRONG_TCGDEX_IMAGES.has(row.id)) {
    const base = tcgdexImageBase(sets.get(row.set)!.serie!, row.set, row.number)
    if (await urlExists(`${base}/low.webp`, 'assets')) return void (row.image = base)
  }
  const base = tcgplayerImageBase(card.productId)
  if (await urlExists(cardImage(base)!.large, 'tcgplayer-images')) row.image = base
})
console.log(`  ${rows.filter((row) => !row.image).length} cartes sans image`)

// 4. L'identifiant Cardmarket, pour les prix (`scripts/prices.ts`) : seul TCGdex le donne.
await mapPool(found, 8, async ({ row, known }) => {
  if (known) row.cardmarket = await cardmarketId(row.id)
})
console.log(`  ${rows.filter((row) => row.cardmarket).length} cartes reliées à Cardmarket`)

// L'extension la plus ancienne d'abord, puis l'extension, le numéro et l'id.
rows.sort(
  (a, b) =>
    compareText(sets.get(a.set)!.releaseDate, sets.get(b.set)!.releaseDate) ||
    compareText(a.set, b.set) ||
    a.number.localeCompare(b.number, 'en', { numeric: true }) ||
    compareText(a.id, b.id),
)

// Une carte qui quitte l'index emporte ce que l'utilisateur en avait noté (statut, achat) : on le dit.
const previous = await readFile(
  join(import.meta.dirname, '..', 'src', 'data', 'card-index.json'),
  'utf8',
)
  .then((text) => (JSON.parse(text) as CardIndexFile).cards.map((row) => row.id))
  .catch(() => [])
const kept = new Set(rows.map((row) => row.id))
const gone = previous.filter((id) => !kept.has(id))
if (gone.length) console.warn(`  ${gone.length} cartes quittent l'index : ${gone.join(', ')}`)

await writeDataFile('card-index.json', (generatedAt) => ({
  generatedAt,
  sets: Object.fromEntries(
    usedSetIds.map((id) => {
      const { name, releaseDate } = sets.get(id)!
      return [id, { name, releaseDate }]
    }),
  ),
  cards: rows,
}))
