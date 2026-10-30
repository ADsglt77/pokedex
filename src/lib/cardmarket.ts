/**
 * Ce que l'app sait de Cardmarket : l'id d'un produit et sa page (la ligne d'une carte pour une
 * liste de souhaits vient de l'API des données : `/api/wants`). Ses images ne s'affichent que sur
 * cardmarket.com (le serveur refuse les autres sites). Un seul lien construit : la page d'un
 * produit par son id (`cardmarketPage`) ; aucun autre n'est deviné.
 */

import { cardLanguage } from '@/lib/collection'
import { parseLink } from '@/lib/format'
import type { CardLanguage, PokemonCard } from '@/types'

/**
 * Les filtres des offres, ajoutés à la page d'une carte (choix de l'utilisateur, octobre 2026) : la
 * langue de la carte (`language` : 7 pour le japonais, 2 pour le français, à faire vérifier par
 * l'utilisateur sur cardmarket.com), Near Mint au moins (`minCondition=2`). Ceux d'une adresse
 * collée qui en porte déjà restent les siens.
 */
const OFFER_LANGUAGE: Record<CardLanguage, string> = { ja: '7', fr: '2' }

/**
 * La page d'une carte chez Cardmarket, avec les filtres des offres : celle notée (adresse collée),
 * sinon celle de son id, `/fr/Pokemon/Products?idProduct=864066`, qui mène à la page du produit
 * (vérifié par l'utilisateur en octobre 2026 ; `/Products/Singles?idProduct=` ne marche pas).
 * `null` sans l'un ni l'autre.
 */
export function cardmarketPage(card: Pick<PokemonCard, 'page' | 'cardmarket' | 'language'>) {
  const page =
    card.page ??
    (card.cardmarket === undefined
      ? null
      : `https://www.cardmarket.com/fr/Pokemon/Products?idProduct=${card.cardmarket}`)
  if (!page) return null
  const url = new URL(page)
  const filters = { language: OFFER_LANGUAGE[cardLanguage(card)], minCondition: '2' }
  for (const [name, value] of Object.entries(filters)) {
    if (!url.searchParams.has(name)) url.searchParams.set(name, value)
  }
  return url.href
}

/** Un lien collé vers une page de Cardmarket ; `null` s'il ne mène pas à www.cardmarket.com. */
export function parseCardmarketLink(text: string): string | null {
  const url = parseLink(text)
  return url?.protocol === 'https:' && url.hostname === 'www.cardmarket.com' ? url.href : null
}

/**
 * Un id Cardmarket saisi ; `null` s'il est vide, `undefined` s'il n'est pas un nombre (ou vaut 0 :
 * aucun produit, la carte n'aurait jamais de prix).
 */
export function readCardmarketId(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (!trimmed) return null
  return /^\d{1,9}$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : undefined
}

/** Une image de Cardmarket : elle ne s'affichera pas dans l'app. */
export const isCardmarketImage = (url: URL) => url.hostname.endsWith('.cardmarket.com')
