/**
 * La collection : un store Zustand, enregistré dans le navigateur (`localStorage`) à chaque
 * changement. La clé est celle des versions précédentes : les données suivent.
 */

import { create } from 'zustand'
import * as rules from '@/lib/collection'
import { parseStored, readCollection } from '@/lib/transfer'
import type { CardStatus, CollectionData, PokemonCard } from '@/types'
import { persist } from './persist'

const COLLECTION_KEY = 'pokedex-collection.collection'

const loadCollection = (text: string | null) =>
  readCollection(parseStored(text)) ?? rules.emptyCollection()

interface CollectionStore {
  collection: CollectionData
  setCardStatus: (card: PokemonCard, status: CardStatus | null) => void
  setPaidPrice: (card: PokemonCard, paidPrice: number | undefined) => void
  saveCard: (card: PokemonCard) => void
  removeCard: (cardId: string) => void
  /** Remplace toute la collection : import, effacement. */
  replaceCollection: (collection: CollectionData) => void
}

export const useCollectionStore = create<CollectionStore>()((set, get) => {
  const update = (change: (collection: CollectionData, now: string) => CollectionData) =>
    set({ collection: change(get().collection, new Date().toISOString()) })

  return {
    collection: loadCollection(localStorage.getItem(COLLECTION_KEY)),

    setCardStatus: (card, status) =>
      update((collection, now) => rules.setCardStatus(collection, card, status, now)),
    setPaidPrice: (card, paidPrice) =>
      update((collection, now) => rules.setPaidPrice(collection, card, paidPrice, now)),
    saveCard: (card) => update((collection, now) => rules.saveCard(collection, card, now)),
    removeCard: (cardId) => update((collection, now) => rules.removeCard(collection, cardId, now)),
    replaceCollection: (collection) => set({ collection }),
  }
})

persist(
  useCollectionStore,
  COLLECTION_KEY,
  (state) => state.collection,
  (text) => ({ collection: loadCollection(text) }),
)
