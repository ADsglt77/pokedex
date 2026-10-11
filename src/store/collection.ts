/** La collection et les réglages, enregistrés dans le navigateur (`localStorage`). */

import { create } from 'zustand'
import { DEFAULT_ENABLED_RARITY_CODES } from '@/config/rarities'
import * as rules from '@/lib/collection'
import { normalizeRarityCodes } from '@/lib/rarity'
import { readCollection, readSettings } from '@/lib/transfer'
import type { AppSettings, CardStatus, CollectionData, PokemonCard } from '@/types'

const COLLECTION_KEY = 'pokedex-collection.collection'
const SETTINGS_KEY = 'pokedex-collection.settings'

const SAVE_FAILED =
  'Vos modifications n’ont pas pu être enregistrées dans ce navigateur (stockage plein ou bloqué). Exportez votre collection pour ne rien perdre.'

export const defaultSettings = (): AppSettings => ({
  schemaVersion: 1,
  enabledRarityCodes: [...DEFAULT_ENABLED_RARITY_CODES],
})

const parseJson = (text: string | null): unknown => {
  try {
    return text === null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Lit un document enregistré. Illisible, il est d'abord copié à part (rien n'est perdu quand
 * la prochaine sauvegarde le remplacera), et le problème est signalé.
 */
function load<T>(key: string, read: (value: unknown) => T | null, fallback: () => T) {
  let text: string | null
  try {
    text = localStorage.getItem(key)
  } catch {
    return {
      value: fallback(),
      issue: 'Ce navigateur n’autorise pas l’enregistrement des données.',
    }
  }
  const value = text === null ? null : read(parseJson(text))
  if (text === null || value !== null) return { value: value ?? fallback(), issue: null }

  const backupKey = `${key.replace('pokedex-collection.', 'pokedex-collection.backup.')}.${new Date().toISOString()}`
  const issue = write(backupKey, text)
    ? `Les données enregistrées dans ce navigateur étaient illisibles : une copie est gardée sous la clé « ${backupKey} » et l’app repart de zéro.`
    : `Les données enregistrées sous « ${key} » sont illisibles et n’ont pas pu être copiées à part : elles seront remplacées à la prochaine modification.`
  return { value: fallback(), issue }
}

function write(key: string, text: string): boolean {
  try {
    localStorage.setItem(key, text)
    return true
  } catch (error) {
    console.error(`Impossible d'enregistrer ${key}`, error)
    return false
  }
}

const save = (key: string, value: unknown) => write(key, JSON.stringify(value))

interface CollectionStore {
  collection: CollectionData
  settings: AppSettings
  /** Problème de lecture ou d'écriture du stockage, à montrer à l'utilisateur. */
  storageIssue: string | null
  dismissStorageIssue: () => void
  setFavorite: (speciesId: number, card: PokemonCard | null) => void
  setCardStatus: (card: PokemonCard, status: CardStatus | null) => void
  setPaidPrice: (card: PokemonCard, paidPrice: number | null) => void
  /** Remplace toute la collection (import, effacement, annulation). */
  replaceCollection: (collection: CollectionData) => void
  setRarityEnabled: (code: string, enabled: boolean) => void
  replaceSettings: (settings: AppSettings) => void
}

const loadedCollection = load(COLLECTION_KEY, readCollection, rules.emptyCollection)
const loadedSettings = load(SETTINGS_KEY, readSettings, defaultSettings)

export const useCollectionStore = create<CollectionStore>()((set, get) => {
  const now = () => new Date().toISOString()
  const update = (change: (collection: CollectionData, now: string) => CollectionData) =>
    set({ collection: change(get().collection, now()) })

  return {
    collection: loadedCollection.value,
    settings: loadedSettings.value,
    storageIssue: loadedCollection.issue ?? loadedSettings.issue,
    dismissStorageIssue: () => set({ storageIssue: null }),

    setFavorite: (speciesId, card) =>
      update((collection, at) => rules.setFavorite(collection, speciesId, card, at)),
    setCardStatus: (card, status) =>
      update((collection, at) => rules.setCardStatus(collection, card, status, at)),
    setPaidPrice: (card, paidPrice) =>
      update((collection, at) => rules.setPaidPrice(collection, card, paidPrice, at)),
    replaceCollection: (collection) => set({ collection }),

    setRarityEnabled: (code, enabled) => {
      const codes = new Set(get().settings.enabledRarityCodes)
      if (enabled) codes.add(code)
      else codes.delete(code)
      set({ settings: { schemaVersion: 1, enabledRarityCodes: normalizeRarityCodes([...codes]) } })
    },
    replaceSettings: (settings) => set({ settings }),
  }
})

// Vrai pendant qu'on reprend ce qu'un autre onglet vient d'enregistrer : inutile de le réécrire.
let syncingFromOtherTab = false

useCollectionStore.subscribe((state, previous) => {
  if (syncingFromOtherTab) return
  const saved = [
    state.collection === previous.collection || save(COLLECTION_KEY, state.collection),
    state.settings === previous.settings || save(SETTINGS_KEY, state.settings),
  ]
  if (saved.includes(false)) useCollectionStore.setState({ storageIssue: SAVE_FAILED })
})

// Sans ça, un onglet resté ouvert réécrirait sa vieille collection par-dessus celle d'un autre.
window.addEventListener('storage', (event) => {
  syncingFromOtherTab = true
  if (event.key === COLLECTION_KEY) {
    const collection = readCollection(parseJson(event.newValue))
    useCollectionStore.setState({ collection: collection ?? rules.emptyCollection() })
  }
  if (event.key === SETTINGS_KEY) {
    useCollectionStore.setState({
      settings: readSettings(parseJson(event.newValue)) ?? defaultSettings(),
    })
  }
  syncingFromOtherTab = false
})
