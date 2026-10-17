/**
 * Le stockage du navigateur (`localStorage`) : lire et écrire une clé, en signalant un refus
 * (`useStorageFailure`, le bandeau de la coquille) ; un store enregistré à chaque changement et
 * suivi entre les onglets (`persist`) ; demander à garder ces données.
 */

import { create, type StoreApi } from 'zustand'

/**
 * Le navigateur a-t-il refusé d'enregistrer (stockage plein, ou bloqué par ses réglages) ? Les
 * modifications restent à l'écran mais seraient perdues en fermant la page : l'app le signale
 * jusqu'au rechargement, et l'export, fait depuis la mémoire, les sauve.
 */
export const useStorageFailure = create(() => ({ failed: false }))

/** Ce que le navigateur garde sous `key` ; `null` s'il refuse l'accès à son stockage. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    useStorageFailure.setState({ failed: true })
    return null
  }
}

/** Enregistre `text` sous `key` (`null` : l'efface) ; un refus du navigateur lève le bandeau. */
export function writeStored(key: string, text: string | null) {
  try {
    if (text === null) localStorage.removeItem(key)
    else localStorage.setItem(key, text)
  } catch {
    useStorageFailure.setState({ failed: true })
  }
}

/**
 * Enregistre une partie d'un store dans le navigateur (`localStorage`, sous `key`) à chaque
 * changement, et reprend ce qu'un autre onglet y enregistre : sans quoi on écraserait sa version au
 * prochain changement. La réécriture qui suit une reprise ne relance rien : `localStorage` ne
 * signale pas une valeur identique.
 */
export function persist<S>(
  store: StoreApi<S>,
  key: string,
  pick: (state: S) => unknown,
  restore: (text: string | null) => Partial<S>,
) {
  store.subscribe((state, previous) => {
    if (pick(state) !== pick(previous)) writeStored(key, JSON.stringify(pick(state)))
  })
  window.addEventListener('storage', (event) => {
    if (event.key === key) store.setState(restore(event.newValue))
  })
}

/**
 * Demande au navigateur de garder ces données même quand la place manque (sur téléphone, il peut
 * effacer le stockage d'un site peu visité). Il peut refuser : rien ne change alors.
 */
export const requestPersistentStorage = () => navigator.storage?.persist?.().catch(() => false)
