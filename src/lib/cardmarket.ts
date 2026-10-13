/**
 * Ce que l'app sait de Cardmarket, vérifié sur une page produit en octobre 2026 : l'id du produit
 * est dans un champ caché (`input[name="idProduct"]`), le titre (`h1`) donne le nom et le numéro
 * (« Pikachu (30C 034) ») puis l'extension. Ses images ne s'affichent que sur cardmarket.com : le
 * serveur refuse les autres sites. Un seul lien construit : la page d'un produit par son id
 * (`cardmarketPage`) ; aucun autre n'est deviné.
 */

import { parseLink } from '@/lib/format'
import type { PokemonCard } from '@/types'

/**
 * La page d'une carte chez Cardmarket : celle notée (favori, adresse collée), sinon celle de son
 * id, `/fr/Pokemon/Products?idProduct=864066`, qui mène à la page du produit (vérifié par
 * l'utilisateur en octobre 2026 ; `/Products/Singles?idProduct=` ne marche pas). `null` sans l'un
 * ni l'autre.
 */
export const cardmarketPage = (card: Pick<PokemonCard, 'page' | 'cardmarket'>) =>
  card.page ??
  (card.cardmarket === undefined
    ? null
    : `https://www.cardmarket.com/fr/Pokemon/Products?idProduct=${card.cardmarket}`)

/** Un lien collé vers une page de Cardmarket ; `null` s'il ne mène pas à www.cardmarket.com. */
export function parseCardmarketLink(text: string): string | null {
  const url = parseLink(text)
  return url?.protocol === 'https:' && url.hostname === 'www.cardmarket.com' ? url.href : null
}

/** Un id Cardmarket saisi ; `null` s'il est vide, `undefined` s'il n'est pas un nombre. */
export function readCardmarketId(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (!trimmed) return null
  return /^\d{1,9}$/.test(trimmed) ? Number(trimmed) : undefined
}

/** Une image de Cardmarket : elle ne s'affichera pas dans l'app. */
export const isCardmarketImage = (url: URL) => url.hostname.endsWith('.cardmarket.com')

/** Ce que le favori envoie d'une page produit. */
export interface CardmarketCard {
  cardmarket: number
  /** « Pikachu (30C 034) » */
  name: string
  /** « 30ᵉ Anniversaire » */
  expansion: string
  /** La page du produit. */
  page: string | null
}

// Le titre de Cardmarket a parfois deux espaces de suite : « Pikachu  (30C 034) ».
const text = (value: string | null) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)

/** L'adresse ouverte par le favori → la carte ; `null` si elle ne vient pas du favori. */
export function readCardmarketCard(params: URLSearchParams): CardmarketCard | null {
  const cardmarket = readCardmarketId(params.get('cardmarket') ?? '')
  if (typeof cardmarket !== 'number') return null
  return {
    cardmarket,
    name: text(params.get('nom')),
    expansion: text(params.get('extension')),
    page: parseCardmarketLink(params.get('page') ?? ''),
  }
}

/**
 * Le favori à glisser dans la barre du navigateur : sur la page d'une carte de Cardmarket, il lit
 * son id, son nom, son extension et l'adresse de la page, puis ouvre `/ajouter` sur `origin`.
 */
export function bookmarklet(origin: string): string {
  // Tient sur une ligne une fois dans le favori : chaque instruction finit par un point-virgule.
  const code = `(() => {
    const id = document.querySelector('input[name="idProduct"]')?.value;
    if (!location.hostname.endsWith('cardmarket.com') || !id) {
      alert('Ouvrez la page d’une carte sur Cardmarket, puis cliquez sur ce favori.');
      return;
    }
    const title = document.querySelector('h1');
    const set = title?.querySelector('span')?.textContent ?? '';
    const params = new URLSearchParams({
      cardmarket: id,
      nom: title?.firstChild?.textContent?.trim() ?? '',
      extension: set.replace(/\\s+-\\s+[^-]+$/, '').trim(),
      page: location.origin + location.pathname,
    });
    window.open(${JSON.stringify(`${origin}/ajouter?`)} + params, '_blank');
  })();`
  return `javascript:${encodeURIComponent(code.replace(/\n\s*/g, ' '))}`
}
