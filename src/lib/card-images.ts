/**
 * Les images des cartes japonaises et françaises, copiées par l'API des données et servies par le
 * site (`/images/…`, que son nginx garde en cache) : des chemins neutres, sans le nom d'une source,
 * ceux du français sous `fr/` (les codes des séries se répètent d'une langue à l'autre : SVP).
 * Celle d'une carte du catalogue : sa langue, le code de sa série et son rang (`catalogImage`) ;
 * pour une référence hors du catalogue, elle se déduit de la référence : « Bulbizarre (sv2a 166) »,
 * le code de la série puis le numéro (`cardImage`). La collection garde ces chemins ; une adresse
 * collée s'affiche telle quelle, sauf une de chez la source (`isSourceImage`, qui ne la nomme pas).
 */

import { numberKey, referenceCode, setKey } from '@/lib/card-code'
import { parseLink } from '@/lib/format'
import type { CardImage, CardLanguage } from '@/types'

/** Le dossier d'une langue dans les chemins : aucun pour le japonais (chemins d'avant), `fr/`. */
const folder = (lang: CardLanguage) => (lang === 'fr' ? 'fr/' : '')

/** Une image retrouvée (un chemin du site), et non une adresse collée. */
export const isFoundImage = (image: CardImage) => image.small.startsWith('/images/cards/')

/**
 * L'image d'une carte : sa langue, le code de sa série et son rang ; `md` pour la grille, `hd`
 * pour la fiche.
 */
export function catalogImage(lang: CardLanguage, set: string, rank: number | string): CardImage {
  const base = `/images/cards/${folder(lang)}${set}/${rank}`
  return { small: `${base}-md.webp`, large: `${base}-hd.webp` }
}

/**
 * L'image que la référence désigne dans cette langue, d'après son code : la série en majuscules et
 * sans tiret (SV-P → SVP), le numéro sans zéro devant. `null` sans code dans la référence. Elle
 * n'existe pas toujours : `findCardImage` (`card-catalog.ts`) vérifie.
 */
export function cardImage(reference: string, lang: CardLanguage): CardImage | null {
  const code = referenceCode(reference)
  return code && catalogImage(lang, setKey(code.set), numberKey(code.number))
}

/** L'empreinte d'un nom de domaine : FNV-1a sur 32 bits. */
function fingerprint(domain: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < domain.length; i++) hash = Math.imul(hash ^ domain.charCodeAt(i), 0x01000193)
  return hash >>> 0
}

/**
 * Les domaines de la source du catalogue (son site, ses serveurs d'images), par leur empreinte : le
 * code que reçoit le navigateur ne la nomme pas. Lesquels : `docs/cartes.md`.
 */
const SOURCE_DOMAINS = new Set([0xdef02a18, 0x6e583970, 0x82cad49f])

/**
 * Une adresse chez la source du catalogue (son nom de domaine, ou un domaine parent, est l'un des
 * siens) : son accord interdit d'afficher ses images depuis chez elle (copiées et servies par le
 * site seulement). Refusée comme adresse collée, jamais affichée.
 */
export function isSourceImage(url: string) {
  const labels = parseLink(url)?.hostname.replace(/\.$/, '').split('.') ?? []
  return labels.some((_, index) => SOURCE_DOMAINS.has(fingerprint(labels.slice(index).join('.'))))
}

/** Le logo d'une série, en deux tailles : `md` pour la liste, `hd` en tête de page. */
export const setLogo = (lang: CardLanguage, set: string, size: 'md' | 'hd') =>
  `/images/sets/${folder(lang)}${set}-${size}.webp`

/** L'icône d'un type de carte (`CARD_TYPES`). */
export const typeIcon = (type: number) => `/images/types/${type}.webp`

/** L'icône d'une rareté (« SAR », ●…). */
export const rarityIcon = (rarity: number) => `/images/rarities/${rarity}.webp`
