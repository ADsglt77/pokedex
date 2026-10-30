import { useEffect, useMemo } from 'react'
import { matchPath, useLocation, useSearchParams } from 'react-router'
import {
  filterUpdate,
  parseFilters,
  pokedexUrl,
  serializeFilters,
  type PokedexFilters,
} from '@/lib/filters'

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

  // Le champ de recherche suit la frappe aussitôt (`filterUpdate`) ; la grille, elle, en différé
  // (PokedexPage).
  const setFilters = (patch: Partial<PokedexFilters>) =>
    setParams(
      (current) => serializeFilters({ ...parseFilters(current), ...patch }),
      filterUpdate('search' in patch),
    )

  return [filters, setFilters] as const
}
