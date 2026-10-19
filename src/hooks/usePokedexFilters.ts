import { useEffect, useMemo } from 'react'
import { matchPath, useLocation, useSearchParams } from 'react-router'
import { parseFilters, pokedexUrl, serializeFilters, type PokedexFilters } from '@/lib/filters'

/** Les paramètres de l'adresse du Pokédex tel qu'on l'a quitté. */
let lastSearch = ''

/** L'adresse du Pokédex tel qu'on l'a quitté : le lien retour d'une fiche garde les filtres. */
export const pokedexHref = () => pokedexUrl(parseFilters(new URLSearchParams(lastSearch)))

/**
 * Les filtres vivent dans l'adresse : une vue filtrée se partage et survit au retour arrière.
 * Caché (une autre page est ouverte, la coquille le garde en vie), le classeur garde les siens.
 */
export function usePokedexFilters() {
  const [params, setParams] = useSearchParams()
  const onPokedex = matchPath('/pokedex', useLocation().pathname) !== null
  const search = onPokedex ? params.toString() : lastSearch
  const filters = useMemo(() => parseFilters(new URLSearchParams(search)), [search])

  useEffect(() => {
    if (onPokedex) lastSearch = search
  }, [onPokedex, search])

  const setFilters = (patch: Partial<PokedexFilters>) =>
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
    })

  return [filters, setFilters] as const
}
