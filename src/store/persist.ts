import type { StoreApi } from 'zustand'

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
    if (pick(state) !== pick(previous)) localStorage.setItem(key, JSON.stringify(pick(state)))
  })
  window.addEventListener('storage', (event) => {
    if (event.key === key) store.setState(restore(event.newValue))
  })
}
