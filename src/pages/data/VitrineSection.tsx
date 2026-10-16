import { Button, Stack, Switch } from '@camply/ui'
import { Copy, ExternalLink as ExternalIcon } from '@camply/ui/icons'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useNotify } from '@/hooks/useNotify'
import { loginPath } from '@/lib/auth-client'
import { useSyncStore } from '@/store/sync'
import { DataSection } from './DataSection'

/**
 * Le Pokédex public (`/vitrine`) : le montrer ou non, et son adresse. Seulement connecté : il montre
 * la collection du compte, telle que le serveur l'a reçue.
 */
export function VitrineSection() {
  const synced = useSyncStore((state) => state.status !== 'local')
  return (
    <DataSection
      id="public"
      title="Pokédex public"
      description="Une page à montrer, en lecture seule : votre progression, vos Pokémon débloqués et les cartes que vous avez choisies, la valeur de la collection au prix du jour et sa courbe. Jamais vos prix payés, vos commandes, votre budget ni votre liste d’achats."
    >
      {synced ? (
        <VitrineSettings />
      ) : (
        <p className="muted">
          Il montre la collection de votre compte :{' '}
          <Link to={loginPath('/donnees#public')}>connectez-vous</Link> pour le rendre public.
        </p>
      )}
    </DataSection>
  )
}

/** Le réglage du compte (`/api/vitrine/settings`), lu à l'ouverture de la page. */
function VitrineSettings() {
  const notify = useNotify()
  // `null` : pas encore lu.
  const [shown, setShown] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const address = `${location.origin}/vitrine`

  useEffect(() => {
    let current = true
    fetch('/api/vitrine/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { public: boolean } | null) => current && setShown(body?.public ?? false))
      .catch(() => current && setShown(false))
    return () => {
      current = false
    }
  }, [])

  const change = async (next: boolean) => {
    setBusy(true)
    const response = await fetch('/api/vitrine/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public: next }),
    }).catch(() => null)
    setBusy(false)
    if (response?.ok) {
      setShown(next)
      notify(next ? 'Votre Pokédex est public.' : 'Votre Pokédex n’est plus public.')
    } else {
      notify(
        response?.status === 409
          ? 'Votre collection n’est pas encore sur le serveur : réessayez dans un instant.'
          : 'Changement impossible pour le moment : réessayez plus tard.',
        { tone: 'danger' },
      )
    }
  }

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
    <Stack gap={4} align="start">
      <Switch
        label="Rendre mon Pokédex public"
        hint="Il montre la version de votre collection enregistrée sur le serveur."
        checked={shown ?? false}
        disabled={shown === null || busy}
        onChange={(event) => void change(event.target.checked)}
      />
      {shown && (
        <Stack gap={2} align="start">
          <p>
            À l’adresse <strong className="numeric">{address}</strong>, pour qui la connaît.
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
      )}
    </Stack>
  )
}
