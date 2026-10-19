import { Button, Input, Stack } from '@camply/ui'
import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useNotify } from '@/hooks/useNotify'
import { authCall, authClient } from '@/lib/auth'
import { refusalMessage } from '@/lib/account'
import { pokedexTitle } from '@/lib/format'
import { markExpired, renameAccount, useSyncStore } from '@/store/sync'

/**
 * Sans session (401) : une connexion sur un autre appareil a fermé celle-ci (une seule à la
 * fois) ; le menu du compte propose alors de se reconnecter.
 */
const EXPIRED =
  'Session expirée (connexion sur un autre appareil ?) : reconnectez-vous depuis le menu du compte.'
import { DataSection } from './DataSection'

/**
 * Mon compte : le pseudo (« Le Pokédex de … », sur le Pokédex public) et le mot de passe. Le site
 * n'envoie pas d'e-mail : pas de mot de passe oublié, on le change ici en donnant l'actuel.
 */
export function AccountSection() {
  const account = useSyncStore((state) => state.account)
  return (
    <DataSection
      id="compte"
      title="Mon compte"
      description={
        account?.email
          ? `Connecté avec ${account.email}. Le site n’envoie pas d’e-mail : gardez bien votre mot de passe.`
          : 'Le site n’envoie pas d’e-mail : gardez bien votre mot de passe.'
      }
    >
      <Stack gap={6}>
        <NameForm current={account?.name ?? ''} />
        <PasswordForm />
      </Stack>
    </DataSection>
  )
}

function NameForm({ current }: { current: string }) {
  const notify = useNotify()
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)
  const next = name.trim()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const { error } = await authCall(() => authClient.updateUser({ name: next }))
    setBusy(false)
    if (error?.status === 401) markExpired()
    if (error) {
      const message = refusalMessage(
        { 401: EXPIRED },
        error.status,
        'Pseudo inchangé : réessayez plus tard.',
      )
      return notify(message, { tone: 'danger' })
    }
    renameAccount(next)
    notify(`Pseudo changé : « ${pokedexTitle(next)} ».`)
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={3} align="start">
        <Input
          label="Pseudo"
          hint="Montré sur le Pokédex public : « Le Pokédex de … »."
          autoComplete="nickname"
          maxLength={40}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={!next || next === current}
        >
          Changer le pseudo
        </Button>
      </Stack>
    </form>
  )
}

/**
 * Le message d'un refus, d'après la réponse du serveur : un mauvais mot de passe actuel (400), et
 * non une session expirée (401), qui ferait croire le mot de passe perdu (pas de « mot de passe
 * oublié »).
 */
const failure = (status: number) =>
  refusalMessage(
    { 400: 'Mot de passe actuel incorrect.', 401: EXPIRED },
    status,
    'Changement impossible pour le moment : réessayez plus tard.',
  )

function PasswordForm() {
  const notify = useNotify()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const currentField = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    // Toute autre session est fermée : un appareil qui aurait gardé l'ancienne ne peut plus rien.
    const { error: refused } = await authCall(() =>
      authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      }),
    )
    setBusy(false)
    if (refused?.status === 401) markExpired()
    if (refused) {
      // Le refus s'affiche sous le mot de passe actuel, qui reçoit le focus : il est lu avec lui.
      flushSync(() => setError(failure(refused.status)))
      currentField.current?.focus()
      return
    }
    setCurrent('')
    setNext('')
    notify('Mot de passe changé.')
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={3} align="start">
        <Input
          ref={currentField}
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          error={error ?? undefined}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Input
          label="Nouveau mot de passe"
          hint="8 caractères au moins."
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy}>
          Changer le mot de passe
        </Button>
      </Stack>
    </form>
  )
}
