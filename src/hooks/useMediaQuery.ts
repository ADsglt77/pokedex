import { useCallback, useSyncExternalStore } from 'react'

/** Vrai tant que l'écran répond à la requête média ; suit ses changements (lu dès le 1er rendu). */
export function useMediaQuery(query: string) {
  // Le même abonnement d'un rendu à l'autre : React ne se réabonne qu'à une autre requête.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches)
}

/**
 * Un téléphone : 40rem de large au plus, la même borne que les feuilles CSS
 * (`@media (max-width: 40rem)`, une douzaine de modules) ; à changer avec elles.
 */
export const usePhone = () => useMediaQuery('(max-width: 40rem)')
