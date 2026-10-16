import { Button, Input, Stack } from '@camply/ui'
import { useState, type FormEvent } from 'react'
import { TOO_MANY_ATTEMPTS } from '@/components/AuthCard'
import { useNotify } from '@/hooks/useNotify'
import { authClient } from '@/lib/auth-client'
import { ofName } from '@/lib/format'
import { renameAccount, useSyncStore } from '@/store/sync'
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
    const { error } = await authClient
      .updateUser({ name: next })
      .catch(() => ({ error: { status: 0 } }))
    setBusy(false)
    if (error) return notify('Pseudo inchangé : réessayez plus tard.', { tone: 'danger' })
    renameAccount(next)
    notify(`Pseudo changé : « Le Pokédex ${ofName(next)} ».`)
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

/** Le message d'un refus, d'après la réponse du serveur. */
const failure = (status: number) =>
  status === 400 || status === 401
    ? 'Mot de passe actuel incorrect.'
    : status === 429
      ? TOO_MANY_ATTEMPTS
      : 'Changement impossible pour le moment : réessayez plus tard.'

function PasswordForm() {
  const notify = useNotify()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    // Toute autre session est fermée : un appareil qui aurait gardé l'ancienne ne peut plus rien.
    const { error: refused } = await authClient
      .changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true })
      .catch(() => ({ error: { status: 0 } }))
    setBusy(false)
    if (refused) return setError(failure(refused.status))
    setCurrent('')
    setNext('')
    notify('Mot de passe changé.')
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={3} align="start">
        <Input
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
