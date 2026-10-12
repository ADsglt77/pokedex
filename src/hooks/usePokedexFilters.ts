import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseFilters, serializeFilters, type PokedexFilters } from '@/lib/filters'

let lastSearch = ''

/** L'adresse du Pokédex tel qu'on l'a quitté : le lien retour d'une fiche garde les filtres. */
export const pokedexHref = () => (lastSearch ? `/pokedex?${lastSearch}` : '/pokedex')

/** Les filtres vivent dans l'adresse : une vue filtrée se partage et survit au retour arrière. */
export function usePokedexFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  useEffect(() => {
    lastSearch = serializeFilters(filters).toString()
  }, [filters])

  const setFilters = useCallback(
    (patch: Partial<PokedexFilters>) =>
      setParams((current) => serializeFilters({ ...parseFilters(current), ...patch }), {
        // Pas une entrée d'historique par filtre ou par frappe.
        replace: true,
        preventScrollReset: true,
        // Le routeur passe ses mises à jour dans une transition : le champ de recherche, qui lit
        // l'adresse, suivrait la frappe en retard. La grille, elle, reste différée (PokedexPage).
        flushSync: 'search' in patch,
      }),
    [setParams],
  )

  return [filters, setFilters] as const
}
