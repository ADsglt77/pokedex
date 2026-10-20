import { Button, EmptyState, type EmptyStateProps } from '@camply/ui'
import { CloudOff, RotateCw } from '@camply/ui/icons'

/**
 * Ce qui ne peut pas s'afficher (`title`) : le serveur n'a pas répondu. Avec `retry`, « Réessayer
 * », en chargement pendant le nouvel essai (`retrying`) : le message et son bouton restent, le
 * focus dessus, jusqu'à la nouvelle réponse.
 */
export function Unavailable({
  title,
  headingLevel,
  retry,
}: {
  title: string
  headingLevel?: EmptyStateProps['headingLevel']
  retry?: { retrying: boolean; onRetry: () => void }
}) {
  return (
    <EmptyState
      headingLevel={headingLevel}
      icon={<CloudOff size={22} />}
      title={title}
      description="Le serveur ne répond pas pour le moment : réessayez dans un instant."
      actions={
        retry && (
          <Button
            loading={retry.retrying}
            leftIcon={<RotateCw size={16} />}
            onClick={retry.onRetry}
          >
            Réessayer
          </Button>
        )
      }
    />
  )
}
