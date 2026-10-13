/**
 * Construit le catalogue des cartes Pokémon japonaises à partir de TCGdex : `src/data/catalog.json`.
 * Pour chaque Pokémon, ses cartes, des plus récentes aux plus anciennes (dans une extension, du plus
 * grand numéro au plus petit) : extension, numéro, id Cardmarket (pour le prix ; 0 si TCGdex ne le
 * connaît pas, ou s'il est douteux : partagé par plusieurs cartes, ou d'un autre Pokémon dans la
 * liste des produits de Cardmarket), suffixe (ex, V, GX…), produit TCGplayer (son image quand
 * Pokécardex n'a pas la sienne, `lib/tcgplayer.ts` ; 0 : aucun) et, pour une carte de plusieurs
 * Pokémon (TAG TEAM), tous ses Pokémon ; et chaque extension, avec son nom japonais, sa date de
 * sortie et les groupes TCGplayer de ses cartes (où `prices.ts` lit le prix de celles sans prix
 * Cardmarket). L'app y choisit une carte ; ses images viennent de Pokécardex (sinon TCGplayer), ses
 * prix du guide de Cardmarket (sinon de TCGplayer).
 * Aucun tri par rareté ni détection des pleines cartes : toutes les cartes Pokémon.
 *
 *   bun run data:catalog [--refresh]   (--refresh : nouvelles cartes, nouveaux id et produits
 *                                       Cardmarket)
 */

import { TOTAL_SPECIES } from '@/config/pokedex'
import speciesFile from '@/data/species.json'
import { speciesInName } from '@/lib/filters'
import type { CatalogFile, CatalogRow } from '@/types'
import { writeDataFile } from './lib/dataFile'
import { fetchJson, mapPool } from './lib/net'
import { tcgplayerProducts } from './lib/tcgplayer'

const GRAPHQL = 'https://api.tcgdex.net/v2/graphql'
const REST = 'https://api.tcgdex.net/v2/ja'
const PAGE_SIZE = 5000
/** La liste publique des cartes de Cardmarket : leur nom anglais, pour vérifier l'id de TCGdex. */
const CARDMARKET_PRODUCTS =
  'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json'

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

// Les id de TCGdex ne sont pas tous justes : celui que plusieurs cartes se partagent, ou que la
// liste des produits de Cardmarket donne à un autre Pokémon (« Slurpuff [Draining Kiss | Magical
// Shot] » pour une carte de Sucroquin), est retiré : pas de prix plutôt que celui d'une autre
// carte. Un nom où aucun Pokémon n'est reconnu, ou un id absent de la liste, est gardé.
const { products: listed } = await fetchJson<{ products: { idProduct: number; name: string }[] }>(
  CARDMARKET_PRODUCTS,
  'cardmarket',
)
const cardmarketNames = new Map(listed.map(({ idProduct, name }) => [idProduct, name]))
const sharing = new Map<number, number>()
for (const id of ids) sharing.set(id, (sharing.get(id) ?? 0) + 1)
const shared: string[] = []
const otherPokemon: string[] = []
for (const [index, { card, dexIds }] of pokemon.entries()) {
  const id = ids[index]!
  // Le nom du produit, sans ses attaques entre crochets : « Slurpuff ».
  const name = cardmarketNames.get(id)?.replace(/\s*\[.*$/, '')
  const named = name === undefined ? null : speciesInName(name)
  const code = `${card.set.id} ${card.localId}`
  if (!id) continue
  if (sharing.get(id)! > 1) shared.push(code)
  else if (named !== null && !dexIds.includes(named)) otherPokemon.push(`${code} : ${name}`)
  else continue
  ids[index] = 0
}
console.log(
  `  ${shared.length + otherPokemon.length} id retirés : ${shared.length} partagés par plusieurs cartes (${shared.slice(0, 5).join(', ')}…), ${otherPokemon.length} d’un autre Pokémon chez Cardmarket (${otherPokemon.slice(0, 5).join(', ')}…)`,
)

// Le produit TCGplayer de chaque carte : son image, quand Pokécardex n'a pas la sienne.
console.log('  produits TCGplayer (pour les images que Pokécardex n’a pas)…')
const products = await tcgplayerProducts(
  pokemon.map(({ card, dexIds }) => ({ setId: card.set.id, number: card.localId, dexIds })),
)
console.log(`  ${products.filter(Boolean).length} reliées à un produit TCGplayer`)

const order = pokemon
  .map((entry, index) => ({ ...entry, id: ids[index]!, product: products[index]! }))
  .sort(
    (a, b) =>
      (released.get(b.card.set.id) ?? '').localeCompare(released.get(a.card.set.id) ?? '') ||
      b.card.set.id.localeCompare(a.card.set.id) ||
      b.card.localId.localeCompare(a.card.localId, 'en', { numeric: true }),
  )

// Des clés numériques : l'objet les garde dans l'ordre des numéros du Pokédex.
const bySpecies: Record<string, CatalogRow[]> = {}
for (const { card, dexIds, id, product } of order) {
  const suffix = SUFFIX.exec(card.name)?.[1] ?? ''
  const row: CatalogRow = [card.set.id, card.localId, id, suffix, product?.productId ?? 0]
  if (dexIds.length > 1) row.push(dexIds)
  for (const dexId of dexIds) (bySpecies[dexId] ??= []).push(row)
}

// Les groupes TCGplayer des cartes de chaque extension.
const groups = new Map<string, Set<number>>()
for (const [index, { card }] of pokemon.entries()) {
  const product = products[index]
  if (!product) continue
  groups.set(card.set.id, (groups.get(card.set.id) ?? new Set<number>()).add(product.groupId))
}

// Les extensions des cartes gardées, des plus récentes aux plus anciennes : [nom, date de sortie,
// groupes TCGplayer s'il y en a].
const usedSets = new Set(pokemon.map(({ card }) => card.set.id))
const setInfo: CatalogFile['sets'] = Object.fromEntries(
  sets
    .filter((set) => usedSets.has(set.id))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    .map((set) => {
      const ids = groups.get(set.id)
      const released = set.releaseDate ?? ''
      return [set.id, ids ? [set.name, released, [...ids]] : [set.name, released]]
    }),
)

await writeDataFile('catalog.json', (generatedAt) => ({
  source: 'TCGdex (api.tcgdex.net)',
  generatedAt,
  sets: setInfo,
  cards: bySpecies,
}))
