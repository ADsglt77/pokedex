import { Button, Stack } from '@camply/ui'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'

/** Filet de sécurité : une erreur d'affichage ne laisse jamais une page blanche. */
export function ErrorPage() {
  return (
    <main className="container" style={{ paddingBlock: '4rem' }}>
      <title>{pageTitle('Erreur')}</title>
      <PageHeader title="Quelque chose s’est mal passé">
        L’affichage de cette page a échoué. Recharger la page règle souvent le problème ; votre
        collection, elle, est toujours enregistrée dans ce navigateur.
      </PageHeader>
      <Stack direction="horizontal" gap={3} wrap>
        <Button variant="primary" onClick={() => location.reload()}>
          Recharger la page
        </Button>
        <Button asChild variant="ghost">
          <Link to="/donnees" reloadDocument>
            Ouvrir les données
          </Link>
        </Button>
      </Stack>
    </main>
  )
}
