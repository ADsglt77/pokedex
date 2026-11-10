import { Button, Stack } from '@camply/ui'
import { useRef, useSyncExternalStore } from 'react'
import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router'
import { Logo } from '@/components/Logo'
import { PageHeader } from '@/components/PageHeader'
import { PokedexUnavailable } from '@/components/PokedexUnavailable'
import { useFocusOnEntry } from '@/hooks/useFocusOnEntry'
import { cx } from '@/lib/cx'
import { pageTitle } from '@/lib/format'
import styles from './ErrorPage.module.css'

/** Le navigateur se dit en ligne ou non (`navigator.onLine`) : suivi à chaque changement. */
const subscribeOnline = (onChange: () => void) => {
  addEventListener('online', onChange)
  addEventListener('offline', onChange)
  return () => {
    removeEventListener('online', onChange)
    removeEventListener('offline', onChange)
  }
}

/**
 * Filet de sécurité : une erreur d'affichage ne laisse jamais une page blanche. Elle remplace la
 * coquille : la marque (logo et nom) en haut. Le message de l'erreur est montré, discret : de quoi
 * la signaler sans ouvrir la console. Les espèces qui manquent à une page (503, `router.tsx`) ne
 * sont pas une erreur d'affichage : le Pokédex ne peut pas s'afficher, à réessayer. Hors ligne (une
 * page chargée à la demande sans réseau, `main.tsx`), recharger mènerait à l'écran d'erreur du
 * navigateur : la page le dit, et ramène à la page précédente ; le réseau revenu, elle propose de
 * recharger.
 */
export function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)
  // Elle remplace la coquille : le focus à son contenu (et, au retour, à celui de la coquille).
  const main = useRef<HTMLElement>(null)
  useFocusOnEntry(main)
  if (isRouteErrorResponse(error) && error.status === 503) return <PokedexUnavailable />
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    <main ref={main} tabIndex={-1} className={cx('container', styles.page)}>
      <title>{pageTitle(online ? 'Erreur' : 'Pas de connexion')}</title>
      <div className={styles.brand}>
        <Logo />
      </div>
      {online ? (
        <PageHeader title="Quelque chose s’est mal passé">
          L’affichage de cette page a échoué. Recharger la page règle souvent le problème&#8239;;
          votre collection, elle, ne risque rien.
        </PageHeader>
      ) : (
        <PageHeader title="Pas de connexion">
          Cette page n’a pas pu se charger&nbsp;: vous êtes hors ligne. Rien n’est perdu, et vos
          modifications partiront au retour du réseau. Revenez à la page précédente, ou rechargez
          celle-ci une fois la connexion revenue.
        </PageHeader>
      )}
      <Stack gap={5} align="start">
        <Stack direction="horizontal" gap={3} wrap>
          {online ? (
            <>
              <Button variant="primary" onClick={() => location.reload()}>
                Recharger la page
              </Button>
              <Button asChild variant="ghost">
                <Link to="/donnees" reloadDocument>
                  Ouvrir les réglages
                </Link>
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => navigate(-1)}>
              Revenir à la page précédente
            </Button>
          )}
        </Stack>
        {message && (
          <p className={cx('muted', styles.detail)}>
            Détail de l’erreur&nbsp;: <code>{message}</code>
          </p>
        )}
      </Stack>
    </main>
  )
}
