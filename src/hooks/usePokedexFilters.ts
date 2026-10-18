import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseFilters, pokedexUrl, serializeFilters, type PokedexFilters } from '@/lib/filters'

let lastHref = '/pokedex'

/** L'adresse du Pokédex tel qu'on l'a quitté : le lien retour d'une fiche garde les filtres. */
export const pokedexHref = () => lastHref

/** Les filtres vivent dans l'adresse : une vue filtrée se partage et survit au retour arrière. */
export function usePokedexFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  useEffect(() => {
    lastHref = pokedexUrl(filters)
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
        // Sans relancer le chargement de la route (le compte) : une navigation qui charge est
        // asynchrone, et le champ, remis un instant à l'ancienne valeur, enverrait le curseur au
        // bout du texte.
        defaultShouldRevalidate: false,
      }),
    [setParams],
  )

  return [filters, setFilters] as const
}
