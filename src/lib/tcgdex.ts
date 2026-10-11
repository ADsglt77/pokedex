import { TOTAL_SPECIES } from '@/config/pokedex'
import type { CardImage, CardSet, PokemonCard } from '@/types'

/** Carte telle que TCGdex la renvoie (REST, GraphQL ou ligne de l'index). */
export interface TcgdexRawCard {
  id?: string
  localId?: string | number
  name?: string | null
  rarity?: string | null
  illustrator?: string | null
  image?: string | null
  dexId?: number[] | null
  set?: { id?: string; name?: string } | null
}

const ID_PREFIX = 'tcgdex:ja:'

/** Cartes que TCGdex range sous la mauvaise espèce, vérifiées sur le nom imprimé. */
const DEX_ID_CORRECTIONS: Readonly<Record<string, number[]>> = {
  'S6K-017': [883],
  'S6K-072': [883],
  'SV-P-132': [569],
}

function text(value: unknown): string | null {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return null
  return value.trim() || null
}

const TCGPLAYER_IMAGES = 'https://tcgplayer-cdn.tcgplayer.com/product/'

/** Base d'image TCGplayer d'un produit, pour les cartes sans image chez TCGdex. */
export const tcgplayerImageBase = (productId: number) => `${TCGPLAYER_IMAGES}${productId}`

/**
 * Base d'image d'une carte → URLs des deux tailles. Une base TCGdex (`…/ja/SV/SV2a/173`) donne
 * `low.webp` (245 × 337) et `high.webp` (600 × 825) ; une base TCGplayer (`…/product/636525`),
 * qui complète les images absentes de TCGdex, n'a qu'une taille utile (320 × 454).
 */
function cardImage(base: string | null | undefined): CardImage | null {
  const url = text(base)?.replace(/\/+$/, '')
  if (!url || !/^https:\/\//.test(url)) return null
  if (url.startsWith(TCGPLAYER_IMAGES)) {
    const image = `${url}_in_1000x1000.jpg`
    return { small: image, large: image }
  }
  return { small: `${url}/low.webp`, large: `${url}/high.webp` }
}

const ASSETS_URL = 'https://assets.tcgdex.net/ja'

/**
 * TCGdex publie des images que son API ne référence pas (`image: null`), à l'adresse habituelle
 * `ja/<série>/<extension>/<numéro>`. Cette base n'est qu'une hypothèse : `bun run data:cards`
 * ne la garde qu'après avoir vérifié que `low.webp` existe.
 */
export const guessImageBase = (serieId: string, setId: string, number: string) =>
  `${ASSETS_URL}/${serieId}/${setId}/${number}`

function validDexIds(values: unknown): number[] {
  if (!Array.isArray(values)) return []
  const ids = values.filter(
    (value): value is number => Number.isInteger(value) && value >= 1 && value <= TOTAL_SPECIES,
  )
  return [...new Set(ids)]
}

export function normalizeTcgdexCard(raw: TcgdexRawCard, knownSet?: CardSet): PokemonCard | null {
  const tcgdexId = text(raw.id)
  if (tcgdexId === null) return null

  const number = text(raw.localId)
  // Un id TCGdex est toujours `<extension>-<numéro>`.
  const setIdFromId =
    number && tcgdexId.endsWith(`-${number}`) ? tcgdexId.slice(0, -number.length - 1) : null
  const setId = knownSet?.id ?? text(raw.set?.id) ?? setIdFromId
  const setName = knownSet?.name ?? text(raw.set?.name)
  const releaseDate = knownSet?.releaseDate ?? null

  return {
    id: `${ID_PREFIX}${tcgdexId}`,
    source: 'tcgdex',
    dexIds: validDexIds(DEX_ID_CORRECTIONS[tcgdexId] ?? raw.dexId),
    name: text(raw.name),
    reference: setId && number ? `${setId} ${number}` : tcgdexId,
    set: setId || setName ? { id: setId, name: setName, releaseDate } : null,
    number,
    rarity: text(raw.rarity),
    illustrator: text(raw.illustrator),
    image: cardImage(raw.image),
    sourceUrl: null,
    note: null,
  }
}
