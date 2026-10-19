/**
 * Le stockage du navigateur (`localStorage`) : lire et écrire une clé, en signalant un refus
 * (`useStorageFailure`, le bandeau de la coquille) ; une valeur illisible mise de côté
 * (`setAsideUnreadable`) ; un store enregistré à chaque changement et suivi entre les onglets
 * (`persist`) ; demander à garder ces données.
 */

import { create, type StoreApi } from 'zustand'

export const useStorageFailure = create<{
  /**
   * Le navigateur a-t-il refusé d'enregistrer (stockage plein, ou bloqué par ses réglages) ? Les
   * modifications restent à l'écran mais seraient perdues en fermant la page : l'app le signale
   * jusqu'au rechargement, et l'export, fait depuis la mémoire, les sauve.
   */
  failed: boolean
  /**
   * La dernière fois (ms) qu'une valeur enregistrée s'est révélée illisible (`setAsideUnreadable`) ;
   * `null` : jamais depuis l'ouverture de la page.
   */
  unreadableAt: number | null
}>(() => ({ failed: false, unreadableAt: null }))

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
 * Une valeur enregistrée sous `key` mais illisible (abîmée, ou d'un format que ce code ne lit pas),
 * que le store remplace par une valeur vide : elle est d'abord mise de côté sous `<key>.illisible`
 * (le prochain changement l'écraserait), et signalée (le bandeau de la coquille). La
 * synchronisation ne prend pas ce vide pour un effacement voulu (`store/sync.ts`).
 */
export function setAsideUnreadable(key: string, text: string) {
  writeStored(`${key}.illisible`, text)
  useStorageFailure.setState({ unreadableAt: Date.now() })
}

/**
 * Enregistre une partie d'un store dans le navigateur (`localStorage`, sous `key`) à chaque
 * changement, une fois pour les changements d'une même action (ajouter une carte possédée en fait
 * deux), et reprend ce qu'un autre onglet y enregistre : sans quoi on écraserait sa version au
 * prochain changement. Une valeur reprise n'est jamais réécrite : un onglet qui traite d'affilée
 * deux changements en attente (gelé en arrière-plan, ou occupé) réécrirait le premier par-dessus
 * le second, et les deux onglets se renverraient ces valeurs jusqu'à s'arrêter sur une ancienne
 * (les dernières modifications perdues).
 */
export function persist<S>(
  store: StoreApi<S>,
  key: string,
  pick: (state: S) => unknown,
  restore: (text: string | null) => Partial<S>,
) {
  let pending = false
  let restoring = false
  store.subscribe((state, previous) => {
    if (restoring || pending || pick(state) === pick(previous)) return
    pending = true
    // Avant la fin de la tâche : la page ne peut pas se fermer entre-temps.
    queueMicrotask(() => {
      pending = false
      writeStored(key, JSON.stringify(pick(store.getState())))
    })
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== key) return
    restoring = true
    try {
      store.setState(restore(event.newValue))
    } finally {
      restoring = false
    }
  })
}

/**
 * Demande au navigateur de garder ces données même quand la place manque (sur téléphone, il peut
 * effacer le stockage d'un site peu visité). Il peut refuser : rien ne change alors.
 */
export const requestPersistentStorage = () => navigator.storage?.persist?.().catch(() => false)
