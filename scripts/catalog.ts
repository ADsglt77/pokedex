/**
 * Construit le catalogue des cartes Pokémon japonaises à partir de TCGdex : `src/data/catalog.json`.
 * Pour chaque Pokémon, ses cartes, des plus récentes aux plus anciennes (dans une extension, du plus
 * grand numéro au plus petit) : extension, numéro, id Cardmarket (pour le prix, 0 si TCGdex ne le
 * connaît pas), suffixe (ex, V, GX…) et, pour une carte de plusieurs Pokémon (TAG TEAM), tous ses
 * Pokémon ; et chaque extension, avec son nom japonais et sa date de sortie. L'app y choisit une
 * carte ; ses images viennent de Pokécardex, ses prix du guide de Cardmarket. Aucun tri par
 * rareté ni détection des pleines cartes : toutes les cartes Pokémon.
 *
 *   bun run data:catalog [--refresh]   (--refresh : nouvelles cartes et nouveaux id Cardmarket)
 */

import { TOTAL_SPECIES } from '@/config/pokedex'
import speciesFile from '@/data/species.json'
import { writeDataFile } from './lib/dataFile'
import { fetchJson, mapPool } from './lib/net'

const GRAPHQL = 'https://api.tcgdex.net/v2/graphql'
const REST = 'https://api.tcgdex.net/v2/ja'
const PAGE_SIZE = 5000

interface RawCard {
  id: string
  localId: string
  name: string
  dexId: (number | null)[] | null
  set: { id: string }
}

/** Une requête GraphQL. Une réponse sans données arrête le script ; des erreurs sont signalées. */
async function graphql<T>(query: string): Promise<T> {
  const { data, errors } = await fetchJson<{ data?: T; errors?: { message: string }[] }>(
    GRAPHQL,
    'tcgdex',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  )
  if (!data) throw new Error(`TCGdex ne répond pas : ${errors?.[0]?.message ?? 'réponse vide'}`)
  if (errors?.length)
    console.warn(`  TCGdex signale ${errors.length} erreurs (${errors[0]!.message})`)
  return data
}

/** Le suffixe imprimé après le nom japonais : « ピカチュウex » → ex. */
const SUFFIX = /(VSTAR|VMAX|V-UNION|V|GX|EX|Ex|ex|BREAK)$/

// Les Pokémon par leur nom japonais : « リーフィア » → 470.
const BY_JAPANESE_NAME = new Map(
  speciesFile.species.flatMap(({ id, names }) => (names.ja ? [[names.ja, id] as const] : [])),
)

/**
 * Les Pokémon d'une carte : ceux de TCGdex ; sinon (il n'en donne pas pour certaines cartes, dont
 * des ex récentes), celui dont le nom japonais est exactement celui de la carte, une fois ôtés son
 * suffixe et « (Pokémon δ) ». Si besoin : son premier ou son dernier mot (« オーガポン みどりの
 * めん » : Ogerpon et son masque ; « ヒスイ バクフーン » : Typhlosion de Hisui), sans « メガ »,
 * « かがやく », « ブラック » ni « ホワイト » devant (Méga, Radieux, Kyurem Noir ou Blanc), ou ce qui
 * suit « の » (« ヒビキのホウオウ » : le Ho-Oh d'Ethan). « リーフィアex » → Phyllali. Une
 * correspondance de noms, pas une détection : un nom qui ne correspond pas laisse la carte de côté.
 */
function speciesOf(card: RawCard): number[] {
  const known = [...new Set(card.dexId ?? [])].filter(
    (id): id is number => id !== null && Number.isInteger(id) && id >= 1 && id <= TOTAL_SPECIES,
  )
  if (known.length) return known
  const name = card.name
    .replace(/（デルタ種）$/, '')
    .replace(SUFFIX, '')
    .trim()
  const candidates = [
    name,
    name.split(' ')[0]!,
    name.split(' ').at(-1)!,
    name.replace(/^(メガ|かがやく|ブラック|ホワイト)/, ''),
    name.split('の').at(-1)!,
  ]
  const named = candidates.map((candidate) => BY_JAPANESE_NAME.get(candidate)).find(Boolean)
  return named ? [named] : []
}

console.log('Cartes Pokémon japonaises de TCGdex…')
const cards: RawCard[] = []
// Jusqu'à une page vide : une page plus courte que demandé ne dit pas que c'est la dernière.
for (let page = 1; ; page++) {
  const { cards: chunk } = await graphql<{ cards: RawCard[] }>(
    `query { cards(filters: {category: "Pokemon"}, pagination: {page: ${page}, itemsPerPage: ${PAGE_SIZE}}) @locale(lang: "ja") { id localId name dexId set { id } } }`,
  )
  if (chunk.length === 0) break
  cards.push(...chunk)
}
const { sets } = await graphql<{
  sets: { id: string; name: string; releaseDate: string | null }[]
}>(`
  query {
    sets @locale(lang: "ja") {
      id
      name
      releaseDate
    }
  }
`)
const released = new Map(sets.map((set) => [set.id, set.releaseDate ?? '']))

const pokemon = cards.flatMap((card) => {
  const dexIds = speciesOf(card)
  return dexIds.length ? [{ card, dexIds }] : []
})
const recognized = new Set(pokemon.map(({ card }) => card))
const unnamed = cards.filter((card) => !recognized.has(card))
console.log(`  ${pokemon.length} cartes ; ${unnamed.length} sans Pokémon reconnu, laissées de côté`)
if (unnamed.length)
  console.log(
    `    (${unnamed
      .slice(0, 8)
      .map((card) => card.name)
      .join(', ')}…)`,
  )
console.log('  id Cardmarket, une carte à la fois (cache ensuite)…')

// L'id Cardmarket n'est donné que carte par carte. Une carte que TCGdex ne sert pas (erreur
// répétée) reste sans id : elle n'arrête pas le reste.
let done = 0
let failed = 0
const ids = await mapPool(pokemon, 4, async ({ card }) => {
  try {
    const detail = await fetchJson<{ pricing?: { cardmarket?: { idProduct?: number } } }>(
      `${REST}/cards/${encodeURIComponent(card.id)}`,
      'tcgdex',
    )
    return detail.pricing?.cardmarket?.idProduct ?? 0
  } catch {
    failed++
    return 0
  } finally {
    if (++done % 1000 === 0) console.log(`  ${done} / ${pokemon.length}`)
  }
})
const withId = ids.filter(Boolean).length
console.log(`  ${withId} avec un id Cardmarket${failed ? `, ${failed} illisibles` : ''}`)

/** Une carte : [extension, numéro, id Cardmarket, suffixe, ses Pokémon s'ils sont plusieurs]. */
type Row = [string, string, number, string, number[]?]

const order = pokemon
  .map((entry, index) => ({ ...entry, id: ids[index]! }))
  .sort(
    (a, b) =>
      (released.get(b.card.set.id) ?? '').localeCompare(released.get(a.card.set.id) ?? '') ||
      b.card.set.id.localeCompare(a.card.set.id) ||
      b.card.localId.localeCompare(a.card.localId, 'en', { numeric: true }),
  )

// Des clés numériques : l'objet les garde dans l'ordre des numéros du Pokédex.
const bySpecies: Record<string, Row[]> = {}
for (const { card, dexIds, id } of order) {
  const suffix = SUFFIX.exec(card.name)?.[1] ?? ''
  const row: Row = [card.set.id, card.localId, id, suffix]
  if (dexIds.length > 1) row.push(dexIds)
  for (const dexId of dexIds) (bySpecies[dexId] ??= []).push(row)
}

// Les extensions des cartes gardées, des plus récentes aux plus anciennes : [nom, date de sortie].
const usedSets = new Set(pokemon.map(({ card }) => card.set.id))
const setInfo = Object.fromEntries(
  sets
    .filter((set) => usedSets.has(set.id))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    .map((set) => [set.id, [set.name, set.releaseDate ?? '']]),
)

await writeDataFile('catalog.json', (generatedAt) => ({
  source: 'TCGdex (api.tcgdex.net)',
  generatedAt,
  sets: setInfo,
  cards: bySpecies,
}))
