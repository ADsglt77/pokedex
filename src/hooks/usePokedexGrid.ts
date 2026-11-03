import { useDeferredValue, useMemo, useState } from 'react'
import type { PokedexEntry } from '@/lib/pokedex'

/** Les pochettes du premier affichage : plus qu'un grand écran n'en montre. */
const FIRST_TILES = 60

/**
 * Ce que reçoit la grille d'un classeur (`PokedexGrid` : le Pokédex, le Pokédex public). `ordered` :
 * toutes les pochettes, dans l'ordre de la grille ; `visible` : celles que les filtres montrent, les
 * autres restent, masquées (un filtre ne refait pas des centaines de pochettes). Au premier
 * affichage, les pochettes d'un écran d'abord, toutes les autres juste après, en arrière-plan
 * (`useDeferredValue` avec une valeur de départ) : la page paraît sans attendre les 1 025 ; toutes
 * d'emblée si `whole` le dit (lu au premier rendu seulement). Les intertitres des générations, si
 * la liste montrée en couvre plusieurs, dès le premier écran : l'intertitre ajouté ensuite
 * pousserait les pochettes déjà peintes.
 */
export function usePokedexGrid(
  ordered: PokedexEntry[],
  visible: PokedexEntry[],
  whole?: () => boolean,
) {
  const [first] = useState(() => (whole?.() ? ordered : ordered.slice(0, FIRST_TILES)))
  const entries = useDeferredValue(ordered, first)
  const shown = useMemo(() => new Set(visible.map((entry) => entry.species.id)), [visible])
  const headings = useMemo(
    () => new Set(visible.map((entry) => entry.species.generation)).size > 1,
    [visible],
  )
  return { entries, shown, headings }
}
