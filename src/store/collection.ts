/**
 * La collection : un store Zustand, en mémoire ; lue sur le serveur à la connexion, et chaque
 * changement y est envoyé (`store/account.ts`).
 */

import { create } from 'zustand'
import * as rules from '@/lib/collection'
import * as series from '@/lib/series'
import { useShoppingStore } from '@/store/shopping'
import type { AddAs, CardLanguage, CardStatus, CollectionData, PokemonCard } from '@/types'

interface CollectionStore {
  collection: CollectionData
  setCardStatus: (card: PokemonCard, status: CardStatus | null) => void
  setPaidPrice: (card: PokemonCard, paidPrice: number | undefined) => void
  saveCard: (card: PokemonCard) => void
  /** La carte favorite de ce Pokémon : celle qu'on montre pour lui. */
  setFavorite: (speciesId: number, cardId: string) => void
  /**
   * Retire la carte de ce Pokémon (une carte de plusieurs Pokémon reste celle des autres) ;
   * `favorite` remplace la sienne si c'en était la favorite et qu'il garde d'autres cartes.
   */
  removeCard: (cardId: string, speciesId: number, favorite?: string) => void
  /**
   * Commence la collection d'une extension avec ses cases (une nouvelle carte `seriesOnly` par
   * carte de l'extension, dans son ordre) : les cartes déjà dans le compte sont reprises.
   */
  startSeries: (
    start: { set: string; language: CardLanguage; name: string },
    slots: PokemonCard[],
  ) => void
  /**
   * Supprime la collection d'une extension : ses cartes possédées, commandées ou dans une commande
   * (celles du magasin des achats) restent.
   */
  removeSeries: (set: string, language: CardLanguage) => void
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
    setFavorite: (speciesId, cardId) =>
      update((collection, now) => rules.setFavorite(collection, speciesId, cardId, now)),
    removeCard: (cardId, speciesId, favorite) =>
      update((collection, now) => rules.removeCard(collection, cardId, speciesId, now, favorite)),
    startSeries: (start, slots) =>
      update((collection, now) => series.startSeries(collection, start, slots, now)),
    removeSeries: (code, language) =>
      update((collection, now) => {
        const { orders } = useShoppingStore.getState().shopping
        return series.removeSeries(collection, code, language, orders, now)
      }),
    replaceCollection: (collection) => set({ collection }),
  }
})

/** Enregistre une carte ajoutée, possédée si `addAs` le dit (sinon, elle est à acheter). */
export function addCard(card: PokemonCard, addAs: AddAs) {
  const collection = useCollectionStore.getState()
  collection.saveCard(card)
  if (addAs === 'owned') collection.setCardStatus(card, 'owned')
}
