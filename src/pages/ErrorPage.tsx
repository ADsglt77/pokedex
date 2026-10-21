import { Button, Stack } from '@camply/ui'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Logo } from '@/components/Logo'
import { PageHeader } from '@/components/PageHeader'
import { PokedexUnavailable } from '@/components/PokedexUnavailable'
import { cx } from '@/lib/cx'
import { pageTitle } from '@/lib/format'
import styles from './ErrorPage.module.css'

/**
 * Filet de sécurité : une erreur d'affichage ne laisse jamais une page blanche. Elle remplace la
 * coquille : la marque (logo et nom) en haut. Le message de l'erreur est montré, discret : de quoi
 * la signaler sans ouvrir la console. Les espèces qui manquent à une page (503, `router.tsx`) ne
 * sont pas une erreur d'affichage : le Pokédex ne peut pas s'afficher, à réessayer.
 */
export function ErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 503) return <PokedexUnavailable />
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    <main className={cx('container', styles.page)}>
      <title>{pageTitle('Erreur')}</title>
      <div className={styles.brand}>
        <Logo>PokéCodex</Logo>
      </div>
      <PageHeader title="Quelque chose s’est mal passé">
        L’affichage de cette page a échoué. Recharger la page règle souvent le problème&#8239;;
        votre collection, elle, ne risque rien.
      </PageHeader>
      <Stack gap={5} align="start">
        <Stack direction="horizontal" gap={3} wrap>
          <Button variant="primary" onClick={() => location.reload()}>
            Recharger la page
          </Button>
          <Button asChild variant="ghost">
            <Link to="/donnees" reloadDocument>
              Ouvrir les réglages
            </Link>
          </Button>
        </Stack>
        {message && (
          <p className="muted">
            Détail de l’erreur&nbsp;: <code>{message}</code>
          </p>
        )}
      </Stack>
    </main>
  )
}
