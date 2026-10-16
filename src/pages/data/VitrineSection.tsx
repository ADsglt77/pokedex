import { Button, Stack } from '@camply/ui'
import { Copy, ExternalLink as ExternalIcon } from '@camply/ui/icons'
import { Link } from 'react-router'
import { useNotify } from '@/hooks/useNotify'
import { DataSection } from './DataSection'

/**
 * Le Pokédex public (`/vitrine`), toujours montré : la page d'accueil d'un visiteur. Son adresse, à
 * copier ou ouvrir.
 */
export function VitrineSection() {
  const notify = useNotify()
  const address = `${location.origin}/vitrine`

  // Hors https (le site ouvert par l'adresse de la machine sur le réseau local…), pas de
  // presse-papiers.
  const copy = () =>
    navigator.clipboard
      ? navigator.clipboard.writeText(address).then(
          () => notify('Adresse copiée.'),
          () => notify('Copie impossible : le navigateur refuse.', { tone: 'danger' }),
        )
      : notify('Copie impossible : le presse-papiers n’est accessible qu’en https.', {
          tone: 'danger',
        })

  return (
    <DataSection
      id="public"
      title="Pokédex public"
      description="Ce que voit un visiteur qui n’est pas connecté, en lecture seule : votre progression, vos Pokémon débloqués et les cartes que vous avez choisies, la valeur de la collection au prix du jour et sa courbe. Jamais vos prix payés, vos commandes ni votre budget."
    >
      <Stack gap={2} align="start">
        <p>
          À l’adresse <strong className="numeric">{address}</strong> : c’est là qu’arrive un
          visiteur qui ouvre le site.
        </p>
        <Stack direction="horizontal" gap={2} wrap>
          <Button size="sm" variant="secondary" leftIcon={<Copy size={14} />} onClick={copy}>
            Copier l’adresse
          </Button>
          <Button asChild size="sm" variant="ghost" leftIcon={<ExternalIcon size={14} />}>
            <Link to="/vitrine" target="_blank">
              Ouvrir
            </Link>
          </Button>
        </Stack>
      </Stack>
    </DataSection>
  )
}
