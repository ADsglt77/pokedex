/**
 * Les images des cartes japonaises et françaises, copiées par l'API des données et servies par le
 * site (`/images/…`, gardées un an par les navigateurs) : des chemins neutres, sans le nom d'une
 * source, ceux du français sous `fr/` (les codes des séries se répètent d'une langue à l'autre :
 * SVP).
 * Celle d'une carte du catalogue : sa langue, le code de sa série et son rang (`catalogImage`) ;
 * une référence hors du catalogue n'a pas d'image retrouvée. La collection garde ces chemins ; une
 * adresse collée s'affiche telle quelle, sauf une de chez la source (`isSourceImage`, qui ne la
 * nomme pas). Les chemins suivent les gabarits du contrat (`CardScanPath`…) : même règle que
 * `../pokedex-data/src/lib/image-paths.ts`, qui copie les images à ces chemins.
 */

import { parseLink } from '@/lib/format'
import type {
  CardImage,
  CardLanguage,
  CardScanPath,
  ImageSize,
  RarityIconPath,
  SetLogoPath,
  TypeIconPath,
} from '@/types'

/** Le dossier d'une langue dans les chemins : aucun pour le japonais (chemins d'avant), `fr/`. */
const folder = (lang: CardLanguage) => (lang === 'fr' ? 'fr/' : '')

/** Une image retrouvée (un chemin du site), et non une adresse collée. */
export const isFoundImage = (image: CardImage) => image.small.startsWith('/images/cards/')

/** Le scan d'une carte à une taille. */
const cardScan = (lang: CardLanguage, set: string, rank: number, size: ImageSize): CardScanPath =>
  `/images/cards/${folder(lang)}${set}/${rank}-${size}.webp`

/**
 * L'image d'une carte : sa langue, le code de sa série et son rang ; `md` pour la grille, `hd`
 * pour la fiche.
 */
export function catalogImage(lang: CardLanguage, set: string, rank: number): CardImage {
  return { small: cardScan(lang, set, rank, 'md'), large: cardScan(lang, set, rank, 'hd') }
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

/**
 * Une image qui s'affiche : ni la petite (grille) ni la grande (fiche) n'est une adresse de chez la
 * source (`isSourceImage`), jamais affichée.
 */
export const showsImage = (image: CardImage | null | undefined): image is CardImage =>
  !!image && !isSourceImage(image.small) && !isSourceImage(image.large)

/** Le logo d'une série, en deux tailles : `md` pour la liste, `hd` en tête de page. */
export const setLogo = (lang: CardLanguage, set: string, size: ImageSize): SetLogoPath =>
  `/images/sets/${folder(lang)}${set}-${size}.webp`

/** L'icône d'un type de carte (`CARD_TYPES`). */
export const typeIcon = (type: number): TypeIconPath => `/images/types/${type}.webp`

/** L'icône d'une rareté (« SAR », ●…). */
export const rarityIcon = (rarity: number): RarityIconPath => `/images/rarities/${rarity}.webp`
