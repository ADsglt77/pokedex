/**
 * Les images des cartes japonaises, chez Pokécardex (avec son accord, octobre 2026 : copiées et
 * hébergées chez nous). L'adresse exacte vient du catalogue
 * (la série et le rang de la carte chez Pokécardex) ; pour une référence hors du catalogue, elle se
 * déduit de la référence : « Bulbizarre (sv2a 166) », le code de la série puis le numéro.
 * La collection garde l'adresse d'origine ; le navigateur charge la copie qu'en a le serveur
 * (`localSrc`, `server/images.ts`), jamais l'original.
 */

import { numberKey, referenceCode, setKey } from '@/lib/card-code'
import type { CardImage } from '@/types'

const SCANS = 'https://pokecardex-scans.b-cdn.net'

/** Une image retrouvée chez Pokécardex, et non une adresse collée. */
export const isFoundImage = (image: CardImage) => image.small.startsWith(SCANS)

/**
 * Le chemin local de l'image d'une carte de Pokécardex (le code de sa série, son rang, sa taille),
 * et son adresse d'origine (`scanUrl`) : les mêmes pour le navigateur (`localSrc`) et pour le
 * serveur qui la copie (`server/images.ts`), sans quoi l'un construirait un chemin que l'autre
 * refuse.
 */
export const SCAN_PATH = /^\/images\/cards\/pokecardex\/([A-Z0-9_-]+)\/(\d{1,4})-(md|hd)\.webp$/

/** L'adresse d'origine d'une image de carte chez Pokécardex. */
export const scanUrl = (set: string, number: string, size: string) =>
  `${SCANS}/sets_jp/${set}/${number}.jpg?class=${size}`

/** L'adresse d'origine d'une image de carte chez Pokécardex, dont le serveur a la copie. */
const SCAN_URL =
  /^https:\/\/pokecardex-scans\.b-cdn\.net\/sets_jp\/([A-Z0-9_-]+)\/(\d{1,4})\.jpg\?class=(md|hd)$/

/**
 * Ce que charge le navigateur pour une image : la copie du serveur pour une image de Pokécardex
 * (`/images/…`, copiée à la demande si besoin) ; une adresse collée, telle quelle. Une adresse de
 * Pokécardex d'une autre forme n'est jamais chargée depuis ses serveurs (son accord) : `null`,
 * pas d'image.
 */
export function localSrc(url: string): string | null {
  if (SCAN_URL.test(url)) return url.replace(SCAN_URL, '/images/cards/pokecardex/$1/$2-$3.webp')
  return url.startsWith(SCANS) ? null : url
}

/**
 * L'image d'une carte chez Pokécardex : `sets_jp/SV2A/6.jpg`, le code de sa série et son rang ;
 * tailles `md` (grille) et `hd` (fiche).
 */
export function pokecardexImage(set: string, number: number | string): CardImage {
  const base = `${SCANS}/sets_jp/${set}/${number}.jpg`
  return { small: `${base}?class=md`, large: `${base}?class=hd` }
}

/**
 * L'image que la référence désigne chez Pokécardex, d'après son code : la série en majuscules et
 * sans tiret (SV-P → SVP), le numéro sans zéro devant. `null` sans code dans la référence.
 * Pokécardex ne l'a pas toujours : `findCardImage` (`card-catalog.ts`) vérifie.
 */
export function cardImage(reference: string): CardImage | null {
  const code = referenceCode(reference)
  return code && pokecardexImage(setKey(code.set), numberKey(code.number))
}

/**
 * Le logo d'une série, copié chez nous (`server/images.ts`) : son logo japonais chez Pokécardex
 * (`logos_jp`, pas le français), en deux tailles : `md` pour la liste des séries, `hd` en tête de
 * la page Catalogue.
 */
export const setLogo = (set: string, size: 'md' | 'hd') => `/images/sets/${set}-${size}.webp`

/** L'icône d'un type de carte (`CARD_TYPES`), copiée chez nous. */
export const typeIcon = (type: number) => `/images/types/${type}.webp`

/** L'icône d'une rareté (« SAR », ●…), copiée chez nous. */
export const rarityIcon = (rarity: number) => `/images/rarities/${rarity}.webp`
