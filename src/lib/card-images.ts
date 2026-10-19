/**
 * Les images des cartes japonaises, copiées par l'API des données et servies par le site
 * (`/images/…`, que son nginx garde en cache) : des chemins neutres, sans le nom d'une source.
 * Celle d'une carte du catalogue : le code de sa série et son rang (`catalogImage`) ; pour une
 * référence hors du catalogue, elle se déduit de la référence : « Bulbizarre (sv2a 166) », le code
 * de la série puis le numéro (`cardImage`). La collection garde ces chemins ; une adresse collée
 * s'affiche telle quelle, sauf une du serveur d'images de la source (`isSourceImage`).
 */

import { numberKey, referenceCode, setKey } from '@/lib/card-code'
import type { CardImage } from '@/types'

/** Une image retrouvée (un chemin du site), et non une adresse collée. */
export const isFoundImage = (image: CardImage) => image.small.startsWith('/images/cards/')

/** L'image d'une carte : le code de sa série et son rang ; `md` pour la grille, `hd` pour la fiche. */
export function catalogImage(set: string, rank: number | string): CardImage {
  const base = `/images/cards/${set}/${rank}`
  return { small: `${base}-md.webp`, large: `${base}-hd.webp` }
}

/**
 * L'image que la référence désigne, d'après son code : la série en majuscules et sans tiret
 * (SV-P → SVP), le numéro sans zéro devant. `null` sans code dans la référence. Elle n'existe pas
 * toujours : `findCardImage` (`card-catalog.ts`) vérifie.
 */
export function cardImage(reference: string): CardImage | null {
  const code = referenceCode(reference)
  return code && catalogImage(setKey(code.set), numberKey(code.number))
}

/**
 * Une adresse du serveur d'images de la source du catalogue : son accord interdit d'afficher ses
 * images depuis chez elle (copiées et servies par le site seulement). Refusée comme adresse
 * collée, jamais affichée.
 */
export const isSourceImage = (url: string) => /^https?:\/\/[^/]*pokecardex/i.test(url)

/** Le logo japonais d'une série, en deux tailles : `md` pour la liste, `hd` en tête de page. */
export const setLogo = (set: string, size: 'md' | 'hd') => `/images/sets/${set}-${size}.webp`

/** L'icône d'un type de carte (`CARD_TYPES`). */
export const typeIcon = (type: number) => `/images/types/${type}.webp`

/** L'icône d'une rareté (« SAR », ●…). */
export const rarityIcon = (rarity: number) => `/images/rarities/${rarity}.webp`
