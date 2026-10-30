import { Button, Input, Stack } from '@camply/ui'
import { Trash2 } from '@camply/ui/icons'
import { useRef, useState, type FormEvent } from 'react'
import { focusAfter } from '@/lib/focus'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { NEW_PASSWORD_FIELD, PSEUDO_FIELD, PSEUDO_HINT } from '@/config/account'
import { useNotify } from '@/hooks/useNotify'
import { authCall, authClient } from '@/lib/auth'
import { PSEUDO_RESERVED, refusalMessage, reservedPseudo } from '@/lib/account'
import { vitrinePath } from '@/lib/filters'
import { pokedexTitle } from '@/lib/format'
import { accountDeleted, markExpired, renameAccount, useAccountStore } from '@/store/account'
import { DataSection } from './DataSection'

/**
 * Sans session (401) : une connexion sur un autre appareil a fermé celle-ci (une seule à la
 * fois) ; le menu du compte propose alors de se reconnecter.
 */
const EXPIRED =
  'Session expirée (connexion sur un autre appareil ?) : reconnectez-vous depuis le menu du compte.'

/**
 * Le message d'un refus d'une action du compte : `badRequest` pour un 400 (pseudo refusé, mot de
 * passe incorrect) ; pour un 401, « session expirée », et non un mauvais mot de passe, qui ferait
 * croire le mot de passe perdu (pas de « mot de passe oublié »), et le menu du compte propose de se
 * reconnecter (`markExpired`).
 */
const failure = (
  refused: { status: number; code?: string },
  badRequest: string,
  otherwise = 'Impossible pour le moment : réessayez plus tard.',
) => {
  if (refused.status === 401) markExpired()
  return refusalMessage({ 400: badRequest, 401: EXPIRED }, refused, otherwise)
}

/**
 * Mon compte : le pseudo (« Le Pokédex de … » et l'adresse du Pokédex public), le mot de passe, et
 * la suppression du compte. Le site n'envoie pas d'e-mail : pas de mot de passe oublié, on le
 * change ici en donnant l'actuel.
 */
export function AccountSection() {
  const name = useAccountStore((state) => state.account?.name ?? '')
  return (
    <DataSection
      id="compte"
      title="Mon compte"
      description="Le site n’envoie pas d’e-mail : gardez bien votre mot de passe, sans lui le compte ne se récupère pas."
    >
      <Stack gap={6}>
        <NameForm current={name} />
        <PasswordForm />
        <DeleteForm />
      </Stack>
    </DataSection>
  )
}

function NameForm({ current }: { current: string }) {
  const notify = useNotify()
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (reservedPseudo(name)) return notify(PSEUDO_RESERVED, { tone: 'danger' })
    setBusy(true)
    const { error } = await authCall(() => authClient.updateUser({ name, username: name }))
    setBusy(false)
    if (error) {
      return notify(
        failure(error, `Pseudo refusé : ${PSEUDO_HINT}`, 'Pseudo inchangé : réessayez plus tard.'),
        { tone: 'danger' },
      )
    }
    renameAccount(name)
    notify(
      `Pseudo changé : « ${pokedexTitle(name)} », à l’adresse ${location.host}${vitrinePath(name)}.`,
    )
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={3} align="start">
        <Input
          {...PSEUDO_FIELD}
          hint={`${PSEUDO_HINT} Le titre de votre Pokédex public (« Le Pokédex de … ») et son adresse.`}
          value={name}
          onChange={(event) => setName(event.target.value.trim())}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={!name || name === current}
        >
          Changer le pseudo
        </Button>
      </Stack>
    </form>
  )
}

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
    // Le refus s'affiche sous le mot de passe actuel, qui reçoit le focus : il est lu avec lui.
    if (refused) {
      return focusAfter(
        () => setError(failure(refused, 'Mot de passe actuel incorrect.')),
        currentField,
      )
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
          {...NEW_PASSWORD_FIELD}
          label="Nouveau mot de passe"
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

/**
 * Supprimer le compte, avec son mot de passe et après confirmation : sa collection, ses achats et
 * son Pokédex public partent du serveur, sans retour (l'export d'abord) ; puis il quitte ce
 * navigateur (`accountDeleted`).
 */
function DeleteForm() {
  const notify = useNotify()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    const { error: refused } = await authCall(() => authClient.deleteUser({ password }))
    if (refused) {
      setBusy(false)
      return focusAfter(() => setError(failure(refused, 'Mot de passe incorrect.')), field)
    }
    await accountDeleted()
    notify('Votre compte est supprimé, avec sa collection.', { tone: 'info' })
    navigate('/connexion', { replace: true })
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setConfirming(true)
        }}
      >
        <Stack gap={3} align="start">
          <Input
            ref={field}
            label="Mot de passe"
            hint="Pour confirmer la suppression du compte."
            type="password"
            autoComplete="current-password"
            required
            error={error ?? undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            tone="danger"
            loading={busy}
            leftIcon={<Trash2 size={14} />}
          >
            Supprimer mon compte
          </Button>
        </Stack>
      </form>
      <ConfirmDialog
        open={confirming}
        title="Supprimer votre compte ?"
        confirmLabel="Supprimer mon compte"
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      >
        <p>
          Votre collection, vos achats, votre budget et votre Pokédex public sont effacés du
          serveur, sans retour possible ; votre pseudo ne sera jamais repris par un autre compte.
          Exportez d’abord votre collection pour la garder.
        </p>
        <ExportCollectionButton />
      </ConfirmDialog>
    </>
  )
}
