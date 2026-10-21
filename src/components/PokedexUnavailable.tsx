import { Button, EmptyState } from '@camply/ui'

/**
 * Le Pokédex ne peut pas s'afficher, une page entière : le serveur ne répond pas au démarrage
 * (`main.tsx`), ou les espèces manquent à une page qui les montre (la coquille, un Pokédex public :
 * `router.tsx`, puis `ErrorPage`). « Réessayer » recharge la page.
 */
export function PokedexUnavailable() {
  return (
    <main className="container">
      <EmptyState
        title="Le Pokédex ne peut pas s’afficher"
        description="Le serveur ne répond pas, ou ses données ne sont pas encore prêtes (premier démarrage). Réessayez dans un instant."
        headingLevel={2}
        actions={<Button onClick={() => location.reload()}>Réessayer</Button>}
      />
    </main>
  )
}
