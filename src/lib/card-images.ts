/**
 * Les images des cartes japonaises, chez Pokécardex (avec son autorisation, octobre 2026),
 * retrouvées d'après la référence : « Bulbizarre (sv2a 166) », le code de l'extension puis le
 * numéro, comme Cardmarket les écrit. L'app ne lit aucune page de Pokécardex (leurs données sont
 * chiffrées) : elle charge seulement l'image, à une adresse déduite de la référence, et cite
 * Pokécardex sous la carte. Quand Pokécardex n'a pas l'image (vieilles séries, decks), celle du
 * produit chez TCGplayer, que le catalogue relie à la carte, citée de même.
 */

import { numberKey, referenceCode, setKey } from '@/lib/card-code'
import { settled } from '@/lib/settled'
import type { CardImage } from '@/types'

const SCANS = 'https://pokecardex-scans.b-cdn.net'
export const POKECARDEX = 'https://www.pokecardex.com/'

const TCGPLAYER_PRODUCTS = 'https://tcgplayer-cdn.tcgplayer.com/product/'
export const TCGPLAYER = 'https://www.tcgplayer.com/'

/** L'image d'un produit TCGplayer : 200 px de large pour les grilles, 500 environ en grand. */
export const tcgplayerImage = (productId: number): CardImage => ({
  small: `${TCGPLAYER_PRODUCTS}${productId}_200w.jpg`,
  large: `${TCGPLAYER_PRODUCTS}${productId}_in_1000x1000.jpg`,
})

export const isTcgplayerImage = (image: CardImage) => image.small.startsWith(TCGPLAYER_PRODUCTS)

/** D'où vient une image, pour la citer sous la carte ; `null` : une adresse collée. */
export function imageSource(image: CardImage): { name: string; href: string } | null {
  if (image.small.startsWith(SCANS)) return { name: 'Pokécardex', href: POKECARDEX }
  if (isTcgplayerImage(image)) return { name: 'TCGplayer', href: TCGPLAYER }
  return null
}

/**
 * Où Pokécardex range l'image de la carte : `sets_jp/SV2A/6.jpg`, le code de l'extension en
 * majuscules et sans tiret (SV-P → SVP), le numéro sans zéro devant ; tailles `md` (grille) et
 * `hd` (fiche). `null` sans code ni numéro dans la référence. Pokécardex ne l'a pas toujours :
 * `findCardImage` vérifie.
 */
export function cardImage(reference: string): CardImage | null {
  const code = referenceCode(reference)
  if (!code) return null
  const base = `${SCANS}/sets_jp/${setKey(code.set)}/${numberKey(code.number)}.jpg`
  return { small: `${base}?class=md`, large: `${base}?class=hd` }
}

const found = new Map<string, Promise<CardImage | null>>()
const missing = new Set<string>()

/**
 * L'image de la carte chez Pokécardex, si elle s'y charge ; `null` sinon. La même promesse pour la
 * même référence (ce qu'attend `use`). `retry`, au moment d'enregistrer, redemande une image qui a
 * échoué : une panne passagère ne doit pas compter pour une image absente. Sans réponse en 10 s,
 * elle compte pour absente : l'enregistrement, qui l'attend, ne reste pas bloqué.
 */
export function findCardImage(reference: string, { retry = false } = {}) {
  let promise = found.get(reference)
  if (!promise || (retry && missing.has(reference))) {
    const image = cardImage(reference)
    promise = settled(
      new Promise<CardImage | null>((resolve) => {
        if (!image) return resolve(null)
        const probe = new Image()
        const fail = () => {
          missing.add(reference)
          resolve(null)
        }
        const timer = setTimeout(() => {
          probe.onload = probe.onerror = null
          fail()
        }, 10_000)
        probe.onload = () => {
          clearTimeout(timer)
          missing.delete(reference)
          resolve(image)
        }
        probe.onerror = () => {
          clearTimeout(timer)
          fail()
        }
        probe.src = image.small
      }),
    )
    found.set(reference, promise)
  }
  return promise
}
