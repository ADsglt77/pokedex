/**
 * Le tri d'un tableau (`SortState` de camply) en valeur d'un `Select` « Trier par » : celui qui
 * remplace l'en-tête du tableau, et ses boutons de tri, quand le tableau se range en liste sur un
 * écran étroit (`.stack-sort`, `styles/global.css`). « value:desc » ; `''` : sans tri (les listes
 * de camply n'acceptent que des chaînes).
 */

import type { SortState } from '@camply/ui'

export const sortChoice = (sort: SortState | null) => (sort ? `${sort.key}:${sort.dir}` : '')

export function sortOf(choice: string): SortState | null {
  const [key, dir] = choice.split(':')
  return key && (dir === 'asc' || dir === 'desc') ? { key, dir } : null
}
