/**
 * Les images des cartes japonaises, chez Pokécardex (avec son autorisation, octobre 2026),
 * retrouvées d'après la référence : « Bulbizarre (sv2a 166) », le code de l'extension puis le
 * numéro, comme Cardmarket les écrit. L'app ne lit aucune page de Pokécardex (leurs données sont
 * chiffrées) : elle charge seulement l'image, à une adresse déduite de la référence, et cite
 * Pokécardex sous la carte.
 */

import type { CardImage } from '@/types'

const SCANS = 'https://pokecardex-scans.b-cdn.net'
export const POKECARDEX = 'https://www.pokecardex.com/'

/**
 * Où Pokécardex range l'image de la carte : `sets_jp/SV2A/6.jpg`, le code de l'extension en
 * majuscules et sans tiret (SV-P → SVP), le numéro sans zéro devant ; tailles `md` (grille) et
 * `hd` (fiche). `null` si la référence ne finit pas par un code et un numéro : entre parenthèses
 * comme chez Cardmarket, ou un code qui a un chiffre (« SV4a 349 », pas « Mon Pikachu 2 »).
 * Pokécardex ne l'a pas toujours : `findCardImage` vérifie.
 */
export function cardImage(reference: string): CardImage | null {
  const match = /(\()?([\w.-]+)\s+([a-z]*\d+[a-z]*)\)?\s*$/i.exec(reference.trim())
  if (!match) return null
  const [, parenthesis, set = '', number = ''] = match
  if (!parenthesis && !/\d/.test(set)) return null
  const code = set.toUpperCase().replace(/-/g, '')
  const printed = /^\d+$/.test(number) ? String(Number(number)) : number.toUpperCase()
  const base = `${SCANS}/sets_jp/${code}/${printed}.jpg`
  return { small: `${base}?class=md`, large: `${base}?class=hd` }
}

/** L'image vient-elle de Pokécardex ? La fiche le cite alors, avec un lien. */
export const isPokecardexImage = (image: CardImage) => image.small.startsWith(SCANS)

const found = new Map<string, Promise<CardImage | null>>()
const missing = new Set<string>()

/**
 * L'image de la carte chez Pokécardex, si elle s'y charge ; `null` sinon. La même promesse pour la
 * même référence (ce qu'attend `use`). `retry`, au moment d'enregistrer, redemande une image qui a
 * échoué : une panne passagère ne doit pas compter pour une image absente.
 */
export function findCardImage(reference: string, { retry = false } = {}) {
  let promise = found.get(reference)
  if (!promise || (retry && missing.has(reference))) {
    const image = cardImage(reference)
    promise = new Promise<CardImage | null>((resolve) => {
      if (!image) return resolve(null)
      const probe = new Image()
      probe.onload = () => {
        missing.delete(reference)
        resolve(image)
      }
      probe.onerror = () => {
        missing.add(reference)
        resolve(null)
      }
      probe.src = image.small
    })
    found.set(reference, promise)
  }
  return promise
}
