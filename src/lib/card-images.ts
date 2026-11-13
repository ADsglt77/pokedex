/**
 * Les images des cartes japonaises et françaises, copiées par l'API des données et servies par le
 * site (`/images/…`, gardées un an par les navigateurs) : des chemins neutres, sans le nom d'une
 * source. Chaque image a sa clé (`ImageKey`, que donne le catalogue : `ja/SV2a/SV2a-166`), la
 * langue en tête (un même id de série existe dans les deux langues) : le scan d'une carte en deux
 * tailles (`catalogImage`), le logo d'une série (`setLogo`). Une référence hors du catalogue n'a pas
 * d'image retrouvée. La collection garde les chemins des scans ; une adresse collée s'affiche telle
 * quelle. Les chemins suivent les gabarits du contrat (`CardScanPath`…).
 */

import type {
  CardImage,
  CardLanguage,
  CardScanPath,
  ImageKey,
  ImageSize,
  SetLogoPath,
} from '@/types'

/** Une image retrouvée (un chemin du site), et non une adresse collée. */
export const isFoundImage = (image: CardImage) => image.small.startsWith('/images/cards/')

/** Le scan d'une carte à une taille. */
const cardScan = (key: ImageKey, size: ImageSize): CardScanPath =>
  `/images/cards/${key}-${size}.webp`

/** L'image d'une carte, d'après sa clé : `md` pour la grille, `hd` pour la fiche. */
export const catalogImage = (key: ImageKey): CardImage => ({
  small: cardScan(key, 'md'),
  large: cardScan(key, 'hd'),
})

/** Le logo d'une série, d'après sa clé (une seule taille). */
export const setLogo = (key: ImageKey): SetLogoPath => `/images/sets/${key}.webp`

/**
 * Une partie d'une clé, encodée comme les clés de l'importateur (`ImageKey`) : seuls
 * `A-Z a-z 0-9 . -` restent tels quels, tout autre octet devient `_XX`.
 */
const keyPart = (part: string) =>
  [...new TextEncoder().encode(part)]
    .map((byte) => {
      const char = String.fromCharCode(byte)
      return /[A-Za-z0-9.-]/.test(char)
        ? char
        : `_${byte.toString(16).toUpperCase().padStart(2, '0')}`
    })
    .join('')

/**
 * La clé du logo d'une série d'après sa langue et son id (`fr/sv03.5`) : pour une collection
 * d'extension, qui ne garde pas celle du catalogue. Une série sans logo n'en a pas l'image (404 :
 * son id à la place, `SetLogo`).
 */
export const setLogoKey = (lang: CardLanguage, set: string): ImageKey => `${lang}/${keyPart(set)}`
