import { Button, EmptyState, type EmptyStateProps } from '@camply/ui'
import { SearchX } from '@camply/ui/icons'
import type { RefObject } from 'react'
import { focusAfter } from '@/lib/focus'

/**
 * Aucun résultat (`title`) pour cette recherche ou ces filtres, le même partout (Pokédex, liste
 * d'achats, Catalogue, fenêtre des extensions) : une piste (`description`), puis le bouton qui les
 * efface (`onReset`, `resetLabel`). Le message et son bouton disparaissent : le focus va à la
 * recherche (`search`).
 */
export function NoMatch({
  title,
  onReset,
  search,
  headingLevel = 2,
  resetLabel = 'Réinitialiser les filtres',
  description = 'Essayez une autre recherche, ou élargissez les filtres.',
}: {
  title: string
  onReset: () => void
  search: RefObject<HTMLInputElement | null>
  headingLevel?: EmptyStateProps['headingLevel']
  resetLabel?: string
  description?: string
}) {
  return (
    <EmptyState
      headingLevel={headingLevel}
      icon={<SearchX size={22} />}
      title={title}
      description={description}
      actions={<Button onClick={() => focusAfter(onReset, search)}>{resetLabel}</Button>}
    />
  )
}
