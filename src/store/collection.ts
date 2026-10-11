/**
 * La collection et les réglages : un store Zustand, enregistré dans le navigateur (`localStorage`)
 * à chaque changement. Les clés sont celles des versions précédentes : les données suivent.
 */

import { create } from 'zustand'
import { DEFAULT_ENABLED_RARITY_CODES } from '@/config/rarities'
import * as rules from '@/lib/collection'
import { knownRarityCodes } from '@/lib/rarity'
import { readCollection, readSettings } from '@/lib/transfer'
import type { AppSettings, CardStatus, CollectionData, PokemonCard } from '@/types'

const COLLECTION_KEY = 'pokedex-collection.collection'
const SETTINGS_KEY = 'pokedex-collection.settings'

export const defaultSettings = (): AppSettings => ({
  schemaVersion: 1,
  enabledRarityCodes: [...DEFAULT_ENABLED_RARITY_CODES],
})

/** Le JSON d'une valeur enregistrée ; `null` si elle est absente ou illisible. */
function parse(text: string | null): unknown {
  try {
    return JSON.parse(text ?? 'null')
  } catch {
    return null
  }
}

const loadCollection = (text: string | null) =>
  readCollection(parse(text)) ?? rules.emptyCollection()
const loadSettings = (text: string | null) => readSettings(parse(text)) ?? defaultSettings()

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
      const codes = get().settings.enabledRarityCodes.filter((known) => known !== code)
      const enabledRarityCodes = knownRarityCodes(enabled ? [...codes, code] : codes)
      set({ settings: { schemaVersion: 1, enabledRarityCodes } })
    },
    replaceSettings: (settings) => set({ settings }),
  }
})

useCollectionStore.subscribe((state, previous) => {
  if (state.collection !== previous.collection) {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(state.collection))
  }
  if (state.settings !== previous.settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
  }
})

// Un autre onglet a enregistré : on reprend sa version, sans quoi on l'écraserait au prochain
// changement. La réécrire ne relance rien : `localStorage` ne signale pas une valeur identique.
window.addEventListener('storage', (event) => {
  if (event.key === COLLECTION_KEY) {
    useCollectionStore.setState({ collection: loadCollection(event.newValue) })
  }
  if (event.key === SETTINGS_KEY) {
    useCollectionStore.setState({ settings: loadSettings(event.newValue) })
  }
})
