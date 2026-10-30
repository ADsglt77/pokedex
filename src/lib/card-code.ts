/**
 * Le code d'une carte : le code de la série et le numéro qui finissent sa référence
 * (« Bulbizarre (SV2A 166) ») ; et ce qui fait la même carte : même langue, et même code ou même
 * id Cardmarket (une carte n'existe qu'une fois), comparés (`isCardOf`) ou en clés
 * (`cardCodeKey`, `cardmarketKey`).
 */

import { cardLanguage } from '@/lib/collection'
import type { CardLanguage, PokemonCard } from '@/types'

interface CardCode {
  set: string
  number: string
}

/**
 * Le code à la fin d'une référence : « Bulbizarre (sv2a 166) » → sv2a, 166. Entre parenthèses
 * comme chez Cardmarket, ou un code qui a un chiffre (« SV4a 349 », pas « Mon Pikachu 2 ») ;
 * `null` sinon.
 */
export function referenceCode(reference: string): CardCode | null {
  const match = /(\()?([\w.-]+)\s+([a-z]*\d+[a-z]*)\)?\s*$/i.exec(reference.trim())
  if (!match) return null
  const [, parenthesis, set = '', number = ''] = match
  return parenthesis || /\d/.test(set) ? { set, number } : null
}

/**
 * Le nom d'une référence, sans le code entre parenthèses qui la finit : « Pikachu ex (M6A 025) »
 * → « Pikachu ex » ; la référence entière si elle n'est que ce code.
 */
export const referenceName = (reference: string) =>
  reference.replace(/\s*\([^()]*\)\s*$/, '') || reference

/** Un numéro comparable : `017` et `17` sont la même carte, `tg01` et `TG01` aussi. */
export const numberKey = (number: string) =>
  /^\d+$/.test(number) ? String(Number(number)) : number.toUpperCase()

/** Une extension comparable : en majuscules et sans tiret (SV-P → SVP), comme chez Pokécardex. */
export const setKey = (set: string) => set.toUpperCase().replace(/-/g, '')

/** La clé d'une carte, la même quelle que soit l'écriture de son code : « SV2A 166 », « E1 97 ». */
const codeKey = ({ set, number }: CardCode) => `${setKey(set)} ${numberKey(number)}`

/**
 * La carte de la collection est-elle celle-là : de cette langue, avec ce code (série et numéro)
 * dans sa référence, ou cet id Cardmarket ?
 */
export function isCardOf(
  card: PokemonCard,
  language: CardLanguage,
  code: CardCode,
  cardmarket: number | undefined,
) {
  if (cardLanguage(card) !== language) return false
  const own = referenceCode(card.reference)
  return (
    (own !== null && codeKey(own) === codeKey(code)) ||
    (cardmarket !== undefined && card.cardmarket === cardmarket)
  )
}

/**
 * Ce qui fait la même carte (`isCardOf`), en clés : deux cartes de la collection de même clé de
 * code (« ja SV2A 166 », sa langue et son code), ou de même clé Cardmarket (« ja 719445 »), sont la
 * même. `null` sans code, sans id. De quoi retrouver une carte parmi des milliers sans les
 * comparer une à une (`startSeries`).
 */
export function cardCodeKey(card: PokemonCard) {
  const code = referenceCode(card.reference)
  return code && `${cardLanguage(card)} ${codeKey(code)}`
}

export const cardmarketKey = (card: PokemonCard) =>
  card.cardmarket === undefined ? null : `${cardLanguage(card)} ${card.cardmarket}`
