import { useSyncExternalStore } from 'react'

/** Vrai tant que l'écran répond à la requête média ; suit ses changements (lu dès le 1er rendu). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
  )
}
