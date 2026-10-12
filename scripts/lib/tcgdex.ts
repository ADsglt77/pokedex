/**
 * TCGdex, cartes japonaises : ce qu'il sait d'une carte (nom japonais, illustrateur, image,
 * Pokémon), ses extensions, et l'id Cardmarket d'une carte (pour les prix).
 */

import { fetchJson } from './net'

const GRAPHQL_URL = 'https://api.tcgdex.net/v2/graphql'
const REST_URL = 'https://api.tcgdex.net/v2/ja'
const PAGE_SIZE = 1000

/** Une carte Pokémon de TCGdex (GraphQL) : les champs facultatifs peuvent valoir `null`. */
export interface TcgdexCard {
  id: string
  localId: string
  name: string | null
  illustrator: string | null
  /** Base d'image : `https://assets.tcgdex.net/ja/SV/SV2a/173`. */
  image: string | null
  dexId: number[] | null
  set: { id: string }
}

export interface TcgdexSet {
  name: string
  releaseDate?: string
  serie: { id: string }
}

/** Toutes les cartes Pokémon japonaises, par pages. */
export async function tcgdexCards(): Promise<TcgdexCard[]> {
  const cards: TcgdexCard[] = []
  for (let page = 1; ; page++) {
    const query = `query { cards(filters: {category: "Pokemon"}, pagination: {page: ${page}, itemsPerPage: ${PAGE_SIZE}}) @locale(lang: "ja") { id localId name illustrator image dexId set { id } } }`
    const { data } = await fetchJson<{ data: { cards: TcgdexCard[] } }>(GRAPHQL_URL, 'tcgdex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    cards.push(...data.cards)
    if (data.cards.length < PAGE_SIZE) return cards
  }
}

export const tcgdexSetIds = async () =>
  (await fetchJson<{ id: string }[]>(`${REST_URL}/sets`, 'tcgdex')).map((set) => set.id)

export const tcgdexSet = (id: string) =>
  fetchJson<TcgdexSet>(`${REST_URL}/sets/${encodeURIComponent(id)}`, 'tcgdex')

/** L'id du produit Cardmarket d'une carte, quand TCGdex le connaît. */
export async function cardmarketId(cardId: string): Promise<number | undefined> {
  const card = await fetchJson<{ pricing?: { cardmarket?: { idProduct: number } } }>(
    `${REST_URL}/cards/${encodeURIComponent(cardId)}`,
    'tcgdex',
  )
  return card.pricing?.cardmarket?.idProduct
}

/** Où TCGdex range l'image d'une carte, même quand son API ne la mentionne pas. */
export const tcgdexImageBase = (serieId: string, setId: string, number: string) =>
  `https://assets.tcgdex.net/ja/${serieId}/${setId}/${number}`
