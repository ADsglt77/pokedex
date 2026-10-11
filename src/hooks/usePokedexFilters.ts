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
      // `replace` : pas une entrée d'historique par filtre ou par frappe.
      setParams((current) => serializeFilters({ ...parseFilters(current), ...patch }), {
        replace: true,
        preventScrollReset: true,
      }),
    [setParams],
  )

  return [filters, setFilters] as const
}
