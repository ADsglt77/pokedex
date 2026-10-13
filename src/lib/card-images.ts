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
 * Une `Map` : un code saisi comme « constructor » ne lit rien d'autre que la table. Le JSON lu par
 * TypeScript ne garde pas les paires : on les retype.
 */
const FOLDERS = new Map(Object.entries(imagesJson.folders) as [string, [string, number]][])

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
  const folder = code && FOLDERS.get(code.set.toLowerCase())
  if (!code || !folder) return null
  const [path, digits] = folder
  const number = /^\d+$/.test(code.number)
    ? String(Number(code.number)).padStart(digits, '0')
    : code.number.toUpperCase()
  const base = `${ASSETS}/${path}/${number}`
  return { small: `${base}/low.webp`, large: `${base}/high.webp` }
}

const loads = new Map<string, Promise<boolean>>()
const failed = new Set<string>()

/**
 * L'image se charge-t-elle ? La réponse est gardée : la même promesse pour la même adresse (ce
 * qu'attend `use`). `retry` redemande une image qui a échoué : une panne passagère de TCGdex ne
 * doit pas compter pour une image absente au moment d'enregistrer.
 */
export function imageLoads(src: string, { retry = false } = {}): Promise<boolean> {
  let promise = loads.get(src)
  if (!promise || (retry && failed.has(src))) {
    promise = new Promise((resolve) => {
      const image = new Image()
      image.onload = () => {
        failed.delete(src)
        resolve(true)
      }
      image.onerror = () => {
        failed.add(src)
        resolve(false)
      }
      image.src = src
    })
    loads.set(src, promise)
  }
  return promise
}
