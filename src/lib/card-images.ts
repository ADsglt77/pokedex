/**
 * Les images des cartes chez TCGdex, retrouvées d'après la référence : « Bulbizarre (sv2a 166) »,
 * le code de l'extension puis le numéro, comme Cardmarket les écrit. La table des extensions vient
 * de `bun run data:images` ; l'app n'appelle pas TCGdex, elle charge seulement l'image.
 */

import imagesJson from '@/data/card-images.json'
import type { CardImage } from '@/types'

const ASSETS = 'https://assets.tcgdex.net'

/**
 * Code de l'extension → [dossier de ses images, longueur de ses numéros (0 : sans zéro devant)].
 * Le JSON lu par TypeScript ne garde pas les paires : on les retype.
 */
const FOLDERS = imagesJson.folders as unknown as Record<string, [string, number]>

/** Le code et le numéro à la fin d'une référence : « Bulbizarre (sv2a 166) » → sv2a, 166. */
function cardCode(reference: string): { set: string; number: string } | null {
  const match = /([\w.-]+)\s+([a-z]*\d+[a-z]*)\)?\s*$/i.exec(reference.trim())
  return match ? { set: match[1]!, number: match[2]! } : null
}

/**
 * Où TCGdex rangerait l'image de la carte d'après sa référence ; `null` si l'extension lui est
 * inconnue. Il ne l'a pas toujours : `imageLoads` le dit.
 */
export function findCardImage(reference: string): CardImage | null {
  const code = cardCode(reference)
  const folder = code && FOLDERS[code.set.toLowerCase()]
  if (!code || !folder) return null
  const [path, digits] = folder
  const number = /^\d+$/.test(code.number)
    ? String(Number(code.number)).padStart(digits, '0')
    : code.number.toUpperCase()
  const base = `${ASSETS}/${path}/${number}`
  return { small: `${base}/low.webp`, large: `${base}/high.webp` }
}

const loads = new Map<string, Promise<boolean>>()

/** L'image se charge-t-elle ? Une fois par adresse : la réponse est gardée. */
export function imageLoads(src: string): Promise<boolean> {
  let promise = loads.get(src)
  if (!promise) {
    promise = new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve(true)
      image.onerror = () => resolve(false)
      image.src = src
    })
    loads.set(src, promise)
  }
  return promise
}
