/**
 * Les images des cartes japonaises, chez Pokécardex (avec son accord, octobre 2026 : copiées et
 * hébergées chez nous, citées avec un lien vers son site). L'adresse exacte vient du catalogue
 * (la série et le rang de la carte chez Pokécardex) ; pour une référence hors du catalogue, elle se
 * déduit de la référence : « Bulbizarre (sv2a 166) », le code de la série puis le numéro.
 * La collection garde l'adresse d'origine ; le navigateur charge la copie qu'en a le serveur
 * (`localSrc`, `server/images.ts`), jamais l'original.
 */

import { numberKey, referenceCode, setKey } from '@/lib/card-code'
import type { CardImage } from '@/types'

const SCANS = 'https://pokecardex-scans.b-cdn.net'
export const POKECARDEX = 'https://www.pokecardex.com/'

/** Une ancienne image de TCGplayer (retiré) : encore affichée si le serveur en a la copie. */
const TCGPLAYER_PRODUCTS = 'https://tcgplayer-cdn.tcgplayer.com/product/'
const TCGPLAYER = 'https://www.tcgplayer.com/'

export const isTcgplayerImage = (image: CardImage) => image.small.startsWith(TCGPLAYER_PRODUCTS)

/** Une image de Pokécardex, et non une adresse collée. */
export const isPokecardexImage = (image: CardImage) => image.small.startsWith(SCANS)

/** Les adresses d'origine dont le serveur a la copie, et le chemin de cette copie. */
const MIRRORED: [RegExp, string][] = [
  [
    /^https:\/\/pokecardex-scans\.b-cdn\.net\/sets_jp\/([\w-]+)\/(\w+)\.jpg\?class=(md|hd)$/,
    '/images/cards/pokecardex/$1/$2-$3.webp',
  ],
  [
    /^https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/(\d+)_(200w|in_1000x1000)\.jpg$/,
    '/images/cards/tcgplayer/$1_$2.jpg',
  ],
]

/**
 * Ce que charge le navigateur pour une image : la copie du serveur pour une image de Pokécardex
 * (`/images/…`, copiée à la demande si besoin) ; une adresse collée, telle quelle.
 */
export function localSrc(url: string) {
  for (const [pattern, path] of MIRRORED) {
    if (pattern.test(url)) return url.replace(pattern, path)
  }
  return url
}

/** D'où vient une image, pour la citer sous la carte ; `null` : une adresse collée. */
export function imageSource(image: CardImage): { name: string; href: string } | null {
  if (isPokecardexImage(image)) return { name: 'Pokécardex', href: POKECARDEX }
  if (isTcgplayerImage(image)) return { name: 'TCGplayer', href: TCGPLAYER }
  return null
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
