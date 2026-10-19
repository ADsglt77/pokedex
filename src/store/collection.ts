/**
 * La collection : un store Zustand, enregistré dans le navigateur (`localStorage`) à chaque
 * changement. La clé est celle des versions précédentes : les données suivent.
 */

import { create } from 'zustand'
import * as rules from '@/lib/collection'
import { parseStored, readCollection } from '@/lib/transfer'
import type { AddAs, CardStatus, CollectionData, PokemonCard } from '@/types'
import { persist, readStored, setAsideUnreadable } from './persist'

const COLLECTION_KEY = 'pokedex-collection.collection'

/** La collection enregistrée ; vide sans elle, ou illisible (mise de côté, signalée). */
function loadCollection(text: string | null) {
  const collection = readCollection(parseStored(text))
  if (collection) return collection
  if (text !== null) setAsideUnreadable(COLLECTION_KEY, text)
  return rules.emptyCollection()
}

interface CollectionStore {
  collection: CollectionData
  setCardStatus: (card: PokemonCard, status: CardStatus | null) => void
  setPaidPrice: (card: PokemonCard, paidPrice: number | undefined) => void
  saveCard: (card: PokemonCard) => void
  /** Retire la carte de ce Pokémon (une carte de plusieurs Pokémon reste celle des autres). */
  removeCard: (cardId: string, speciesId: number) => void
  /** Remplace toute la collection : import, effacement. */
  replaceCollection: (collection: CollectionData) => void
}

export const useCollectionStore = create<CollectionStore>()((set, get) => {
  const update = (change: (collection: CollectionData, now: string) => CollectionData) =>
    set({ collection: change(get().collection, new Date().toISOString()) })

  return {
    collection: loadCollection(readStored(COLLECTION_KEY)),

    setCardStatus: (card, status) =>
      update((collection, now) => rules.setCardStatus(collection, card, status, now)),
    setPaidPrice: (card, paidPrice) =>
      update((collection, now) => rules.setPaidPrice(collection, card, paidPrice, now)),
    saveCard: (card) => update((collection, now) => rules.saveCard(collection, card, now)),
    removeCard: (cardId, speciesId) =>
      update((collection, now) => rules.removeCard(collection, cardId, speciesId, now)),
    replaceCollection: (collection) => set({ collection }),
  }
})

persist(
  useCollectionStore,
  COLLECTION_KEY,
  (state) => state.collection,
  (text) => ({ collection: loadCollection(text) }),
)

/** Enregistre une carte ajoutée, possédée si `addAs` le dit (sinon, elle est à acheter). */
export function addCard(card: PokemonCard, addAs: AddAs) {
  const collection = useCollectionStore.getState()
  collection.saveCard(card)
  if (addAs === 'owned') collection.setCardStatus(card, 'owned')
}
