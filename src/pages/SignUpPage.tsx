import { Alert, Button, Card, CardDescription, CardHeader, Input, Stack } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { pageTitle } from '@/lib/format'
import { sync } from '@/store/sync'
import styles from './AuthPage.module.css'

/** Le message d'un refus, d'après la réponse du serveur. */
const failure = (status: number) =>
  status === 403
    ? 'Cette invitation n’est plus valable (déjà utilisée ou expirée) : demandez-en une nouvelle.'
    : status === 422
      ? 'Un compte existe déjà avec cet e-mail : connectez-vous.'
      : status === 429
        ? 'Trop de tentatives : réessayez dans une minute.'
        : 'Inscription impossible pour le moment : réessayez plus tard.'

/**
 * `/inscription?invitation=…` : créer son compte avec le lien d'invitation qu'un administrateur a
 * donné (Données › Invitations). Sans invitation valable, le serveur refuse (`server/auth.ts`).
 * Ensuite, connecté : la collection de ce navigateur part sur le compte.
 */
export function SignUpPage() {
  const { data: session } = authClient.useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const invitation = params.get('invitation') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mismatch = confirmation !== '' && confirmation !== password

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmation) return
    setBusy(true)
    setError(null)
    const { error: refused } = await authClient.signUp
      .email({
        email: email.trim(),
        password,
        name: email.trim().split('@')[0]!,
        fetchOptions: { headers: { 'X-Invitation': invitation } },
      })
      .catch(() => ({ error: { status: 0 } }))
    setBusy(false)
    if (refused) return setError(failure(refused.status))
    void sync()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <title>{pageTitle('Inscription')}</title>
      <Card padding="lg" className={styles.card}>
        <CardHeader>
          <h1 className={styles.title}>Créer votre compte</h1>
          <CardDescription>
            Pour garder votre collection, vos achats et votre budget sur le serveur, et les
            retrouver sur vos appareils (un seul connecté à la fois).
          </CardDescription>
        </CardHeader>
        {session ? (
          <Stack gap={4}>
            <p>Vous êtes connecté avec {session.user.email}.</p>
            <Button asChild>
              <Link to="/">Continuer</Link>
            </Button>
          </Stack>
        ) : !invitation ? (
          <Stack gap={4}>
            <p>
              L’inscription se fait sur invitation : demandez un lien à l’administrateur du site.
            </p>
            <Button asChild variant="ghost">
              <Link to="/connexion">J’ai déjà un compte</Link>
            </Button>
          </Stack>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <Stack gap={4}>
              {error && <Alert tone="danger" title={error} />}
              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                label="Mot de passe"
                hint="8 caractères au moins."
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Input
                label="Encore une fois"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                error={mismatch ? 'Les deux mots de passe diffèrent.' : undefined}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              <Button
                type="submit"
                fullWidth
                loading={busy}
                disabled={mismatch}
                leftIcon={<UserPlus size={16} />}
              >
                Créer mon compte
              </Button>
            </Stack>
          </form>
        )}
      </Card>
    </div>
  )
}
