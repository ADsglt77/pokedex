/**
 * La collection et les réglages : un store Zustand, enregistré dans le navigateur (`localStorage`)
 * à chaque changement. Les clés sont celles des versions précédentes : les données suivent.
 */

import { create } from 'zustand'
import { DEFAULT_ENABLED_RARITY_CODES, RARITY_CLASSES } from '@/config/rarities'
import * as rules from '@/lib/collection'
import { parseStored, readCollection, readSettings } from '@/lib/transfer'
import type { AppSettings, CardStatus, CollectionData, PokemonCard } from '@/types'
import { persist } from './persist'

const COLLECTION_KEY = 'pokedex-collection.collection'
const SETTINGS_KEY = 'pokedex-collection.settings'

export const defaultSettings = (): AppSettings => ({
  schemaVersion: 1,
  enabledRarityCodes: [...DEFAULT_ENABLED_RARITY_CODES],
})

const loadCollection = (text: string | null) =>
  readCollection(parseStored(text)) ?? rules.emptyCollection()
const loadSettings = (text: string | null) => readSettings(parseStored(text)) ?? defaultSettings()

interface CollectionStore {
  collection: CollectionData
  settings: AppSettings
  setFavorite: (speciesId: number, card: PokemonCard | null) => void
  setCardStatus: (card: PokemonCard, status: CardStatus | null) => void
  setPaidPrice: (card: PokemonCard, paidPrice: number | undefined) => void
  /** Remplace toute la collection : import, effacement. */
  replaceCollection: (collection: CollectionData) => void
  setRarityEnabled: (code: string, enabled: boolean) => void
  replaceSettings: (settings: AppSettings) => void
}

export const useCollectionStore = create<CollectionStore>()((set, get) => {
  const update = (change: (collection: CollectionData, now: string) => CollectionData) =>
    set({ collection: change(get().collection, new Date().toISOString()) })

  return {
    collection: loadCollection(localStorage.getItem(COLLECTION_KEY)),
    settings: loadSettings(localStorage.getItem(SETTINGS_KEY)),

    setFavorite: (speciesId, card) =>
      update((collection, now) => rules.setFavorite(collection, speciesId, card, now)),
    setCardStatus: (card, status) =>
      update((collection, now) => rules.setCardStatus(collection, card, status, now)),
    setPaidPrice: (card, paidPrice) =>
      update((collection, now) => rules.setPaidPrice(collection, card, paidPrice, now)),
    replaceCollection: (collection) => set({ collection }),

    setRarityEnabled: (code, enabled) => {
      const current = get().settings.enabledRarityCodes
      // Dans l'ordre des classes, sans code inconnu (une classe retirée depuis).
      const enabledRarityCodes = RARITY_CLASSES.map((rarityClass) => rarityClass.code).filter(
        (known) => (known === code ? enabled : current.includes(known)),
      )
      set({ settings: { schemaVersion: 1, enabledRarityCodes } })
    },
    replaceSettings: (settings) => set({ settings }),
  }
})

persist(
  useCollectionStore,
  COLLECTION_KEY,
  (state) => state.collection,
  (text) => ({ collection: loadCollection(text) }),
)
persist(
  useCollectionStore,
  SETTINGS_KEY,
  (state) => state.settings,
  (text) => ({ settings: loadSettings(text) }),
)
