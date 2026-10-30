import { Button, Stack } from '@camply/ui'
import { Link, useLocation } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'

/**
 * Dans la coquille : adresse inconnue de plus d'un segment (d'un seul, c'est un Pokédex public :
 * `router.tsx`), numéro de Pokémon qui n'existe pas (`PokemonPage`), collection d'extension pas
 * commencée (`SeriesPage`).
 */
export function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <div className="container">
      <title>{pageTitle('Page introuvable')}</title>
      <PageHeader title="Cette page n’est pas dans le classeur">
        L’adresse <code>{pathname}</code> ne correspond à aucune page.
      </PageHeader>
      <Stack direction="horizontal" gap={3} wrap>
        <Button asChild>
          <Link to="/">Revenir à l’accueil</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/pokedex">Ouvrir le Pokédex</Link>
        </Button>
      </Stack>
    </div>
  )
}
