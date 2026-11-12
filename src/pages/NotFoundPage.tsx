import { Button, EmptyState } from '@camply/ui'
import { SearchX } from '@camply/ui/icons'
import { Link, useLocation } from 'react-router'
import { pageTitle } from '@/lib/format'

/**
 * La page introuvable, la même partout : dans la coquille (`NotFoundPage`) et hors d'elle, au
 * Pokédex public d'une adresse qui n'est à personne (`VitrinePage`, `pseudo` : elle dit aussi qu'un
 * pseudo a pu changer). camply n'offre pas de titre `h1` à `EmptyState` : celui de la page, pour
 * les lecteurs d'écran.
 */
export function NotFound({ pseudo = false }: { pseudo?: boolean }) {
  const { pathname } = useLocation()
  return (
    <>
      <title>{pageTitle('Page introuvable')}</title>
      <h1 className="visually-hidden">Page introuvable</h1>
      <EmptyState
        headingLevel={2}
        icon={<SearchX size={22} />}
        title="Cette page n’est pas dans le classeur"
        description={
          pseudo ? (
            <>
              L’adresse <code>{pathname}</code> ne mène à aucune page, ni au Pokédex public d’un
              compte&nbsp;: vérifiez-la (un pseudo a pu changer, ou un compte être supprimé).
            </>
          ) : (
            <>
              L’adresse <code>{pathname}</code> ne mène à aucune page.
            </>
          )
        }
        actions={
          <Button asChild>
            <Link to="/">Revenir à l’accueil</Link>
          </Button>
        }
      />
    </>
  )
}

/**
 * Dans la coquille : adresse inconnue de plus d'un segment (d'un seul, c'est un Pokédex public :
 * `router.tsx`), numéro de Pokémon qui n'existe pas (`PokemonPage`), collection d'extension pas
 * commencée (`SeriesPage`).
 */
export function NotFoundPage() {
  return (
    <div className="container">
      <NotFound />
    </div>
  )
}
