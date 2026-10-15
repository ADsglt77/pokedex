/**
 * Le code d'une carte : le code de la série et le numéro qui finissent sa référence
 * (« Bulbizarre (SV2A 166) »). Sans import : le serveur s'en sert aussi.
 */

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

/** Un numéro comparable : `017` et `17` sont la même carte, `tg01` et `TG01` aussi. */
export const numberKey = (number: string) =>
  /^\d+$/.test(number) ? String(Number(number)) : number.toUpperCase()

/** Une extension comparable : en majuscules et sans tiret (SV-P → SVP), comme chez Pokécardex. */
export const setKey = (set: string) => set.toUpperCase().replace(/-/g, '')

/** La clé d'une carte, la même quelle que soit l'écriture de son code : « SV2A 166 », « E1 97 ». */
export const codeKey = ({ set, number }: CardCode) => `${setKey(set)} ${numberKey(number)}`
