/**
 * Images des cartes. L'index garde une « base » par carte ; l'app en tire l'adresse de chaque
 * taille. TCGdex en a deux, TCGplayer (qui complète ce que TCGdex n'a pas) une seule.
 */

import type { CardImage } from '@/types'

const TCGDEX_ASSETS = 'https://assets.tcgdex.net/ja'
const TCGPLAYER_PRODUCTS = 'https://tcgplayer-cdn.tcgplayer.com/product/'

/** Où TCGdex range l'image d'une carte, même quand son API ne la mentionne pas. */
export const tcgdexImageBase = (serieId: string, setId: string, number: string) =>
  `${TCGDEX_ASSETS}/${serieId}/${setId}/${number}`

export const tcgplayerImageBase = (productId: number) => `${TCGPLAYER_PRODUCTS}${productId}`

/** TCGdex : 245 × 337 et 600 × 825 ; TCGplayer : 320 × 454 pour les deux. */
export function cardImage(base: string | null): CardImage | null {
  if (!base) return null
  if (base.startsWith(TCGPLAYER_PRODUCTS)) {
    const image = `${base}_in_1000x1000.jpg`
    return { small: image, large: image }
  }
  return { small: `${base}/low.webp`, large: `${base}/high.webp` }
}
