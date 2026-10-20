import { Button, EmptyState } from '@camply/ui'
import { SearchX } from '@camply/ui/icons'
import type { RefObject } from 'react'
import { focusAfter } from '@/lib/focus'

/**
 * Aucun résultat (`title`) pour ces filtres (Pokédex, liste d'achats) : « Réinitialiser les
 * filtres » (`onReset`). Le message et son bouton disparaissent : le focus va à la recherche
 * (`search`).
 */
export function NoMatch({
  title,
  onReset,
  search,
}: {
  title: string
  onReset: () => void
  search: RefObject<HTMLInputElement | null>
}) {
  return (
    <EmptyState
      headingLevel={2}
      icon={<SearchX size={22} />}
      title={title}
      description="Essayez une autre recherche, ou élargissez les filtres."
      actions={
        <Button onClick={() => focusAfter(onReset, search)}>Réinitialiser les filtres</Button>
      }
    />
  )
}
