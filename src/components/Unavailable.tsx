import { Button, EmptyState, type ButtonProps, type EmptyStateProps } from '@camply/ui'
import { CloudOff, RotateCw } from '@camply/ui/icons'

/** Ce que dit l'app quand le serveur ne répond pas : la même formule partout. */
export const NO_ANSWER = 'Le serveur ne répond pas pour le moment : réessayez dans un instant.'

/** Un nouvel essai : `useRetry`, `useRetryPrices`. */
interface Retry {
  retrying: boolean
  onRetry: () => void
}

/**
 * « Réessayer », en chargement pendant le nouvel essai (`retrying`) : dans `Unavailable`, et
 * l'alerte des prix de Valeur.
 */
export function RetryButton({
  retry,
  size,
  variant,
}: {
  retry: Retry
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
}) {
  return (
    <Button
      size={size}
      variant={variant}
      loading={retry.retrying}
      leftIcon={<RotateCw size={size === 'sm' ? 14 : 16} />}
      onClick={retry.onRetry}
    >
      Réessayer
    </Button>
  )
}

/**
 * Ce qui ne peut pas s'afficher (`title`) : le serveur n'a pas répondu. Avec `retry`, « Réessayer »
 * (`RetryButton`) : le message et son bouton restent, le focus dessus, jusqu'à la nouvelle réponse.
 */
export function Unavailable({
  title,
  headingLevel,
  retry,
}: {
  title: string
  headingLevel?: EmptyStateProps['headingLevel']
  retry?: Retry
}) {
  return (
    <EmptyState
      headingLevel={headingLevel}
      icon={<CloudOff size={22} />}
      title={title}
      description={NO_ANSWER}
      actions={retry && <RetryButton retry={retry} />}
    />
  )
}
