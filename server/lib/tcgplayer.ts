/**
 * Le catalogue japonais de TCGplayer (catégorie « Pokemon Japan »), lu dans l'export quotidien de
 * tcgcsv.com : côté serveur (tâche `catalog`), User-Agent identifié, requêtes une à une et cache
 * local d'un jour (`net.ts`), comme l'exige tcgcsv. Deux usages :
 * - le produit TCGplayer de chaque carte de TCGdex : son image quand Pokécardex n'a pas la sienne,
 *   son prix quand Cardmarket n'en a pas ;
 * - les cartes que TCGdex n'a pas (decks, promos, sets spéciaux : à peu près autant que les
 *   siennes), ajoutées au catalogue (à la demande de l'utilisateur, octobre 2026, en attendant la
 *   liste de Pokécardex).
 */

import { codeKey, numberKey } from '@/lib/card-code'
import { speciesInName } from '@/lib/filters'
import { fetchJson } from './net'

const TCGCSV = 'https://tcgcsv.com/tcgplayer/85'
/** tcgcsv publie son export une fois par jour. */
const DAY = 86_400_000

interface Group {
  groupId: number
  name: string
  abbreviation: string | null
  /** Le jour où TCGplayer l'a publié (ISO) : celui de la sortie de l'extension, à peu près. */
  publishedOn: string
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

/** Le numéro imprimé, sans le total : `002/165` → `002`. */
const printedNumber = (product: Product) => field(product, 'Number').split('/')[0]!.trim()

/** Une impression de la carte (« (Master Ball Pattern) », « (Mirror Holofoil) »…), pas la carte. */
const isVariant = (product: Product) => product.name.includes('(')

/** Le nom de la carte, sans son numéro ni son impression : « Ivysaur ». */
const cardName = (product: Product) =>
  product.name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/ - .*$/, '')
    .trim()

/** Le suffixe imprimé après le nom anglais : « Pikachu ex » → ex. */
const SUFFIX = / (VSTAR|VMAX|V-UNION|V|GX|EX|ex|BREAK)$/

/**
 * Le code de l'extension d'une carte que TCGdex n'a pas : l'abréviation de son groupe (suivie du
 * numéro du groupe si deux groupes la partagent : « BW6: Cold Flare » et « BW6: Freeze Bolt »,
 * numérotés chacun à part), sinon celle que porte son numéro (« 025/PCG-P »), sinon `TP-` et le
 * numéro du groupe : un code à nous, pour une extension que personne d'autre ne nomme (vieux
 * decks…).
 */
function codeOf(group: Group, product: Product, shared: ReadonlySet<string>) {
  const abbreviation = group.abbreviation?.trim()
  if (abbreviation) {
    return shared.has(setCode(abbreviation)) ? `${abbreviation}-${group.groupId}` : abbreviation
  }
  const total = field(product, 'Number').split('/')[1]?.trim()
  return total && /[A-Z]/i.test(total) ? total : `TP-${group.groupId}`
}

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

/** Une carte que TCGdex n'a pas, prise chez TCGplayer. */
export interface ExtraCard {
  /** Le code de son extension : celui de TCGdex si TCGplayer la relie à une des siennes. */
  setId: string
  /** Le nom de l'extension chez TCGplayer, et son jour (pour une extension que TCGdex n'a pas). */
  setName: string
  released: string
  number: string
  /** ex, V, GX… */
  suffix: string
  productId: number
  groupId: number
  dexIds: number[]
}

/**
 * Le catalogue japonais de TCGplayer, rapproché de celui de TCGdex (`cards`, et le jour de sortie
 * de chaque extension : `released`) :
 * - `products` : le produit TCGplayer de chaque carte de TCGdex (`null` : aucun, ou sans image),
 *   dans le groupe de son extension (même code, sinon `GROUPS`), celui du même numéro ; pour une
 *   série sans numéros (1996-2001), le seul produit de son Pokémon. Toujours du même Pokémon que la
 *   carte, et une seule carte possible (ses impressions comprises) : sinon aucune, pour ne jamais
 *   montrer l'image d'une autre.
 * - `extras` : les autres cartes Pokémon de TCGplayer, une par numéro (ses impressions
 *   confondues). Jamais une que TCGdex a déjà (même code et numéro ; ou même jour de sortie, même
 *   numéro et même Pokémon : MC est chez TCGplayer sans abréviation), ni une sans numéro
 *   (impossible à désigner : distributeurs, promos CoroCoro), ni une dont le Pokémon n'est pas
 *   reconnu, ni deux cartes différentes sous un même numéro : dans le doute, rien.
 */
export async function tcgplayerCatalog(
  cards: readonly CatalogEntry[],
  released: ReadonlyMap<string, string>,
) {
  const { results: groups } = await fetchJson<{ results: Group[] }>(
    `${TCGCSV}/groups`,
    'tcgcsv',
    undefined,
    DAY,
  )
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

  // Les cartes Pokémon de chaque groupe, demandées une à une.
  const products = new Map<number, Product[]>()
  for (const group of groups) {
    const { results } = await fetchJson<{ results: Product[] }>(
      `${TCGCSV}/${group.groupId}/products`,
      'tcgcsv',
      undefined,
      DAY,
    )
    products.set(
      group.groupId,
      results.filter((product) => field(product, 'HP') && product.imageCount > 0),
    )
  }

  const matched = cards.map(({ setId, number, dexIds }): TcgplayerProduct | null => {
    const pool = (groupsOf.get(setId) ?? []).flatMap((group) =>
      products.get(group.groupId)!.map((product) => ({ ...product, groupId: group.groupId })),
    )
    const sameNumber = pool.filter(
      (product) => numberKey(printedNumber(product)) === numberKey(number),
    )
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

  // Les autres cartes, rangées par code d'extension et numéro (impressions confondues).
  const taken = new Set(matched.flatMap((product) => product?.productId ?? []))
  const tcgdexCodes = new Set(cards.map(({ setId, number }) => codeKey({ set: setId, number })))
  const sameDay = new Set(
    cards.flatMap(({ setId, number, dexIds }) =>
      dexIds.map((dexId) => `${released.get(setId)}|${numberKey(number)}|${dexId}`),
    ),
  )
  const linked = new Map(
    [...groupsOf].flatMap(([setId, list]) => list.map((group) => [group.groupId, setId] as const)),
  )
  // Les abréviations que plusieurs groupes (hors TCGdex) se partagent.
  const counts = new Map<string, number>()
  for (const group of groups) {
    const abbreviation = group.abbreviation?.trim()
    if (abbreviation && !linked.has(group.groupId)) {
      counts.set(setCode(abbreviation), (counts.get(setCode(abbreviation)) ?? 0) + 1)
    }
  }
  const shared = new Set([...counts].flatMap(([code, count]) => (count > 1 ? [code] : [])))
  const skipped = { unnumbered: 0, unnamed: 0, ambiguous: 0, known: 0 }
  const byCode = new Map<string, { card: ExtraCard; name: string; variant: boolean }[]>()
  for (const group of groups) {
    for (const product of products.get(group.groupId)!) {
      if (taken.has(product.productId)) continue
      const number = printedNumber(product)
      const name = cardName(product)
      const dexIds = name.split(' & ').map((part) => speciesInName(part))
      if (!number) skipped.unnumbered++
      else if (dexIds.includes(null)) skipped.unnamed++
      else {
        const setId = linked.get(group.groupId) ?? codeOf(group, product, shared)
        const key = codeKey({ set: setId, number })
        const card: ExtraCard = {
          setId,
          setName: group.name,
          released: group.publishedOn.slice(0, 10),
          number,
          suffix: SUFFIX.exec(name)?.[1] ?? '',
          productId: product.productId,
          groupId: group.groupId,
          dexIds: dexIds as number[],
        }
        byCode.set(key, [...(byCode.get(key) ?? []), { card, name, variant: isVariant(product) }])
      }
    }
  }
  const extras: ExtraCard[] = []
  for (const [key, list] of byCode) {
    if (new Set(list.map(({ name }) => name)).size > 1) {
      skipped.ambiguous += list.length
      continue
    }
    const { card } = list.find(({ variant }) => !variant) ?? list[0]!
    const known =
      tcgdexCodes.has(key) ||
      card.dexIds.some((dexId) =>
        sameDay.has(`${card.released}|${numberKey(card.number)}|${dexId}`),
      )
    if (known) skipped.known++
    else extras.push(card)
  }
  return { products: matched, extras, skipped }
}
