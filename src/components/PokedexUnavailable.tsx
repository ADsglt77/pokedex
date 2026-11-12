import { Unavailable } from '@/components/Unavailable'
import { SITE_NAME } from '@/config/legal'

/**
 * Le Pokédex ne peut pas s'afficher, une page entière : le serveur ne répond pas au démarrage
 * (`main.tsx`), ou les espèces manquent à une page qui les montre (la coquille, un Pokédex public :
 * `router.tsx`, puis `ErrorPage`). « Réessayer » recharge la page. camply n'offre pas de titre
 * `h1` à `EmptyState` : celui de la page, le nom du site, pour les lecteurs d'écran.
 */
export function PokedexUnavailable() {
  return (
    <main className="container">
      <h1 className="visually-hidden">{SITE_NAME}</h1>
      <Unavailable
        headingLevel={2}
        title="Le Pokédex ne peut pas s’afficher"
        retry={{ retrying: false, onRetry: () => location.reload() }}
      />
    </main>
  )
}
