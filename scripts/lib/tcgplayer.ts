/**
 * Le produit TCGplayer d'une carte du catalogue, pour son image quand Pokécardex n'a pas la sienne
 * (vieilles séries, decks). Le catalogue japonais de TCGplayer (catégorie « Pokemon Japan »), lu
 * dans l'export quotidien de tcgcsv.com : script côté serveur, User-Agent identifié, requêtes une à
 * une et cache local (`net.ts`), comme l'exige tcgcsv. Seule l'image est reprise : la liste des
 * cartes reste celle de TCGdex.
 */

import { numberKey } from '@/lib/card-code'
import { speciesInName } from '@/lib/filters'
import { fetchJson } from './net'

const TCGCSV = 'https://tcgcsv.com/tcgplayer/85'

interface Group {
  groupId: number
  name: string
  abbreviation: string | null
}

interface Product {
  productId: number
  name: string
  imageCount: number
  extendedData?: { name: string; value: string }[]
}

/**
 * Les extensions de TCGdex qu'aucune abréviation de TCGplayer ne désigne (ou en désigne deux) : le
 * nom de leur groupe chez TCGplayer, vérifié à la date de sortie.
 */
const GROUPS: Readonly<Record<string, string>> = {
  PMCG1: 'Expansion Pack',
  PMCG2: 'Pokemon Jungle',
  PMCG3: 'Mystery of the Fossils',
  PMCG4: 'Rocket Gang',
  PMCG5: "Leaders' Stadium",
  PMCG6: 'Challenge from the Darkness',
  neo1: 'Gold, Silver, to a New World...',
  neo2: 'Crossing the Ruins...',
  neo3: 'Awakening Legends',
  neo4: 'Darkness, and to Light...',
  VS1: 'Pokemon VS',
  web1: 'Pokemon Web',
  E1: 'Base Expansion Pack',
  E2: 'The Town on No Map',
  E3: 'Wind from the Sea',
  E4: 'Split Earth',
  E5: 'Mysterious Mountains',
  PCG1: 'Flight of Legends',
  PCG2: 'Clash of the Blue Sky',
  PCG3: 'Rocket Gang Strikes Back',
  PCG4: 'Golden Sky, Silvery Ocean',
  PCG5: 'Mirage Forest',
  PCG6: 'Holon Research Tower',
  PCG7: 'Holon Phantom',
  PCG8: 'Miracle Crystal',
  PCG9: 'Offense and Defense of the Furthest Ends',
  SM1p: 'sm1+: Enhanced Expansion Pack Sun & Moon',
  SVLS: 'SV: Ceruledge ex Stellar Tera Type Starter Set',
  // MC (Start Deck 100) n'y est pas : TCGplayer numérote chacun de ses decks à part, un numéro y
  // désigne plusieurs cartes. Pokécardex a ses images.
}

/** SM3p chez TCGdex, SM3+ chez TCGplayer, S-P et SP… : un code comparable. */
const setCode = (id: string) =>
  id
    .toUpperCase()
    .replace(/\+$/, 'P')
    .replace(/[^A-Z0-9]/g, '')

const field = (product: Product, name: string) =>
  product.extendedData?.find((data) => data.name === name)?.value ?? ''

/** Le numéro imprimé, sans le total : `002/165` → `2`. */
const printed = (product: Product) => numberKey(field(product, 'Number').split('/')[0]!.trim())

/** Une impression de la carte (« (Master Ball Pattern) », « (Mirror Holofoil) »…), pas la carte. */
const isVariant = (product: Product) => product.name.includes('(')

/** Le nom de la carte, sans son numéro ni son impression : « Ivysaur ». */
const cardName = (product: Product) =>
  product.name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/ - .*$/, '')
    .trim()

/** Ce qu'il faut savoir d'une carte du catalogue pour la retrouver chez TCGplayer. */
export interface CatalogEntry {
  setId: string
  number: string
  dexIds: number[]
}

/** Le produit TCGplayer d'une carte, et son groupe (l'extension chez TCGplayer, pour ses prix). */
export interface TcgplayerProduct {
  productId: number
  groupId: number
}

/**
 * Le produit TCGplayer de chaque carte (`null` : aucun, ou sans image) : dans le groupe de son
 * extension (même code, sinon `GROUPS`), celui du même numéro ; pour une série sans numéros
 * (1996-2001), le seul produit de son Pokémon. Toujours du même Pokémon que la carte, et une seule
 * carte possible (ses impressions comprises) : sinon aucune, pour ne jamais montrer l'image d'une
 * autre.
 */
export async function tcgplayerProducts(
  cards: readonly CatalogEntry[],
): Promise<(TcgplayerProduct | null)[]> {
  const { results: groups } = await fetchJson<{ results: Group[] }>(`${TCGCSV}/groups`, 'tcgcsv')
  const groupsOf = new Map<string, Group[]>()
  for (const setId of new Set(cards.map((card) => card.setId))) {
    const named = GROUPS[setId]
    groupsOf.set(
      setId,
      groups.filter((group) =>
        named
          ? group.name === named
          : group.abbreviation !== null && setCode(group.abbreviation) === setCode(setId),
      ),
    )
  }

  // Les cartes Pokémon de chaque groupe utile, demandées une à une.
  const products = new Map<number, (Product & { groupId: number })[]>()
  for (const group of new Set([...groupsOf.values()].flat())) {
    const { results } = await fetchJson<{ results: Product[] }>(
      `${TCGCSV}/${group.groupId}/products`,
      'tcgcsv',
    )
    products.set(
      group.groupId,
      results
        .filter((product) => field(product, 'HP') && product.imageCount > 0)
        .map((product) => ({ ...product, groupId: group.groupId })),
    )
  }

  return cards.map(({ setId, number, dexIds }) => {
    const pool = (groupsOf.get(setId) ?? []).flatMap((group) => products.get(group.groupId)!)
    const sameNumber = pool.filter((product) => printed(product) === numberKey(number))
    // Le Pokémon que nomme le produit (null : illisible, Nidoran F…) ; sans numéro, il doit l'être.
    const samePokemon = (product: Product, required: boolean) => {
      const id = speciesInName(cardName(product))
      return id === null ? !required : dexIds.includes(id)
    }
    const matches = sameNumber.length
      ? sameNumber.filter((product) => samePokemon(product, false))
      : pool.filter((product) => !field(product, 'Number') && samePokemon(product, true))
    const normal = matches.filter((product) => !isVariant(product))
    const found = normal.length ? normal : matches
    // Une seule carte : un même nom, dans un même groupe (ses impressions comprises). Sans numéro,
    // un seul produit : « Brock's Geodude (Lv.13) » et « (Lv.15) » sont deux cartes, pas deux
    // impressions.
    const single =
      found.length > 0 &&
      new Set(found.map((product) => product.groupId)).size === 1 &&
      new Set(found.map(cardName)).size === 1 &&
      (sameNumber.length > 0 || found.length === 1)
    return single ? { productId: found[0]!.productId, groupId: found[0]!.groupId } : null
  })
}
