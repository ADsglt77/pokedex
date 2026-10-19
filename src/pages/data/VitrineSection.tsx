import { Button, Stack } from '@camply/ui'
import { Copy, ExternalLink as ExternalIcon } from '@camply/ui/icons'
import { Link } from 'react-router'
import { useNotify } from '@/hooks/useNotify'
import { copyText } from '@/lib/clipboard'
import { vitrinePath } from '@/lib/filters'
import { useSyncStore } from '@/store/sync'
import { DataSection } from './DataSection'

/**
 * Le Pokédex public du compte (`/@pseudo`), toujours montré : son adresse, à copier ou ouvrir. Elle
 * suit le pseudo (Mon compte) : l'ancienne ne mène plus à rien.
 */
export function VitrineSection() {
  const notify = useNotify()
  const name = useSyncStore((state) => state.account?.name ?? '')
  const path = vitrinePath(name)
  const address = `${location.origin}${path}`

  const copy = () =>
    copyText(address).then(
      () => notify('Adresse copiée.'),
      () =>
        notify('Copie impossible : le navigateur refuse, ou le site n’est pas ouvert en https.', {
          tone: 'danger',
        }),
    )

  return (
    <DataSection
      id="public"
      title="Pokédex public"
      description="Ce que voit tout visiteur, en lecture seule : votre progression, vos Pokémon débloqués et les cartes que vous avez choisies, la valeur de la collection au prix du jour et la courbe des Pokémon débloqués. Jamais vos prix payés, vos commandes ni votre budget."
    >
      <Stack gap={2} align="start">
        <p>
          À l’adresse <strong className="numeric">{address}</strong>, à partager. Elle suit votre
          pseudo : en le changeant, l’ancienne ne mène plus à rien.
        </p>
        <Stack direction="horizontal" gap={2} wrap>
          <Button size="sm" variant="secondary" leftIcon={<Copy size={14} />} onClick={copy}>
            Copier l’adresse
          </Button>
          <Button asChild size="sm" variant="ghost" leftIcon={<ExternalIcon size={14} />}>
            <Link to={path} target="_blank">
              Ouvrir
            </Link>
          </Button>
        </Stack>
      </Stack>
    </DataSection>
  )
}
