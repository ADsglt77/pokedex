/**
 * La collection : un store Zustand, en mémoire ; lue sur le serveur à la connexion, et chaque
 * changement y est envoyé (`store/account.ts`).
 */

import { create } from 'zustand'
import * as rules from '@/lib/collection'
import type { AddAs, CardStatus, CollectionData, PokemonCard } from '@/types'

interface CollectionStore {
  collection: CollectionData
  setCardStatus: (card: PokemonCard, status: CardStatus | null) => void
  setPaidPrice: (card: PokemonCard, paidPrice: number | undefined) => void
  saveCard: (card: PokemonCard) => void
  /** Retire la carte de ce Pokémon (une carte de plusieurs Pokémon reste celle des autres). */
  removeCard: (cardId: string, speciesId: number) => void
  /** Remplace toute la collection : lue sur le serveur, import, effacement. */
  replaceCollection: (collection: CollectionData) => void
}

export const useCollectionStore = create<CollectionStore>()((set, get) => {
  const update = (change: (collection: CollectionData, now: string) => CollectionData) =>
    set({ collection: change(get().collection, new Date().toISOString()) })

  return {
    collection: rules.emptyCollection(),

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

/** Enregistre une carte ajoutée, possédée si `addAs` le dit (sinon, elle est à acheter). */
export function addCard(card: PokemonCard, addAs: AddAs) {
  const collection = useCollectionStore.getState()
  collection.saveCard(card)
  if (addAs === 'owned') collection.setCardStatus(card, 'owned')
}
