/**
 * Le catalogue TCGplayer des cartes japonaises (catégorie « Pokemon Japan »), lu dans l'export
 * quotidien de tcgcsv.com : la liste des cartes de chaque extension et leur rareté, qui suit le
 * code imprimé. Règles d'usage de tcgcsv : script côté serveur, User-Agent identifié, cache local
 * (voir `net.ts`).
 */

import { fetchJson } from './net'
import { TCGPLAYER_SETS } from './rules'

const TCGCSV_URL = 'https://tcgcsv.com/tcgplayer/85'

export interface Group {
  groupId: number
  name: string
  abbreviation: string | null
  /** Date de sortie : `2020-09-18T00:00:00`. */
  publishedOn: string
}

interface Product {
  productId: number
  name: string
  extendedData?: { name: string; value: string }[]
}

/** Une carte du catalogue. */
export interface CatalogCard {
  productId: number
  /** Nom anglais : « Pikachu V - 104/100 ». */
  name: string
  /** Numéro imprimé, sans le total : `104`. */
  number: string
  /** Numérotée au-delà du total imprimé (`104/100`) : une carte secrète. */
  secret: boolean
  /** La rareté de TCGplayer, telle quelle (`''` sans rareté). */
  rarity: string
  /** La classe de pleine carte que dit sa rareté ; `null` si elle n'en dit pas. */
  code: string | null
  /** Une carte Pokémon (elle a des PV), pas un Dresseur ni une Énergie. */
  isPokemon: boolean
}

/**
 * Raretés de TCGplayer qui font une pleine carte → classes de l'app. Son « Ultra Rare » est l'or
 * (UR) ; « Futuristic Rare » (texturée) et « RGB Rare » (monochrome) sont celles de 30th CELEBRATION.
 */
const RARITY_CODES: Readonly<Record<string, string>> = {
  'Special Art Rare': 'SAR',
  'Art Rare': 'AR',
  'Character Super Rare': 'CSR',
  'Character Rare': 'CHR',
  'Black White Rare': 'BWR',
  'Shiny Secret Rare': 'SSR',
  'Mega Ultra Rare': 'UR',
  'Ultra Rare': 'UR',
  'Hyper Rare': 'HR',
  'Mega Attack Rare': 'SR',
  'Super Rare': 'SR',
  'Futuristic Rare': 'SR',
  'RGB Rare': 'BWR',
}

/**
 * Raretés dont toutes les cartes ont une fenêtre d'illustration (vérifié à l'image) : holo, prisme,
 * radieuses, chromatiques, rééditions à l'ancien cadre…
 */
export const WINDOWED_RARITIES: ReadonlySet<string> = new Set([
  'Shiny Rare',
  'Prism Rare',
  'Kagayaku',
  'Shining',
  'Amazing Rare',
  'Rare Holo LEGEND',
  'Super Rare Holo',
  'Classic Collection',
  'Pikachu Rare',
])

/** TCGdex écrit `p` (« plus ») ce que TCGplayer écrit `+` : SM3p est SM3+. */
const tcgplayerCode = (setId: string) => setId.replace(/p$/, '+').toLowerCase()

let groups: Promise<Group[]> | undefined

/** Tous les groupes du catalogue japonais : extensions, decks, coffrets, promos… */
export const allGroups = () =>
  (groups ??= fetchJson<{ results: Group[] }>(`${TCGCSV_URL}/groups`, 'tcgcsv').then(
    ({ results }) => results,
  ))

/**
 * Les groupes d'une extension : celui de `TCGPLAYER_SETS`, sinon ceux de même abréviation (une
 * extension peut y être répartie sur plusieurs : SM1+).
 */
export async function catalogGroups(setId: string): Promise<Group[]> {
  const named = TCGPLAYER_SETS[setId]?.group
  return (await allGroups()).filter((group) =>
    named ? group.name === named : group.abbreviation?.toLowerCase() === tcgplayerCode(setId),
  )
}

/** Les cartes d'un groupe, une par numéro : la carte normale, pas ses variantes (« (Master Ball Pattern) »…). */
export async function catalogCards(group: Group): Promise<CatalogCard[]> {
  const { results } = await fetchJson<{ results: Product[] }>(
    `${TCGCSV_URL}/${group.groupId}/products`,
    'tcgcsv',
  )
  const cards = new Map<string, CatalogCard>()
  for (const { productId, name, extendedData = [] } of results) {
    const data = Object.fromEntries(extendedData.map((field) => [field.name, field.value]))
    // Un produit sans numéro est un produit scellé (booster, coffret), pas une carte.
    if (!data.Number) continue
    const [number = '', total = ''] = data.Number.split('/').map((part) => part.trim())
    if (cards.has(number) && name.includes('(')) continue
    cards.set(number, {
      productId,
      name,
      number,
      secret: /^\d+$/.test(total) && Number(number) > Number(total),
      rarity: data.Rarity ?? '',
      code: (data.Rarity && RARITY_CODES[data.Rarity]) || null,
      isPokemon: !!data.HP,
    })
  }
  return [...cards.values()]
}
