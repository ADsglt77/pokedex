import { Alert, Button, Input, Stack } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { accountCreated, authClient, TOO_MANY_ATTEMPTS } from '@/lib/auth-client'
import { pageTitle } from '@/lib/format'
import { signIn } from '@/store/sync'
import { AuthCard } from '@/components/AuthCard'
import styles from './AuthPage.module.css'

/** Le message d'un refus, d'après la réponse du serveur. */
const failure = (status: number) =>
  status === 403
    ? 'Création refusée : ce site attend une autre adresse, ou son compte vient d’être créé (rechargez alors la page pour vous connecter).'
    : status === 400
      ? 'Vérifiez l’e-mail et le mot de passe (8 caractères au moins).'
      : status === 429
        ? TOO_MANY_ATTEMPTS
        : 'Création impossible pour le moment : réessayez plus tard.'

/**
 * `/bienvenue` : la première visite, tant que le site n'a pas de compte (le routeur y mène toute
 * page). On crée le seul compte : pseudo, e-mail, mot de passe ; ensuite, plus personne ne peut en
 * créer (`server/auth.ts`). Puis, connecté, la collection de ce navigateur part sur le compte.
 */
export function WelcomePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: refused } = await authClient.signUp
      .email({ name: name.trim(), email: email.trim(), password })
      .catch(() => ({ data: null, error: { status: 0 } }))
    setBusy(false)
    if (refused || !data) return setError(failure(refused?.status ?? 0))
    accountCreated()
    signIn(data.user)
    navigate('/', { replace: true })
  }

  return (
    <AuthCard
      title="Bienvenue"
      description="Ce Pokédex n’a pas encore de compte : créez le vôtre. Ce sera le seul : une fois créé, plus personne ne pourra en créer. Il garde votre collection, vos achats et votre budget sur le serveur, pour les retrouver sur vos appareils (un seul connecté à la fois)."
    >
      <title>{pageTitle('Bienvenue')}</title>
      <form onSubmit={submit} className={styles.form}>
        <Stack gap={4}>
          {error && <Alert tone="danger" title={error} />}
          <Input
            label="Pseudo"
            autoComplete="nickname"
            maxLength={40}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
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
          <Button type="submit" fullWidth loading={busy} leftIcon={<UserPlus size={16} />}>
            Créer mon compte
          </Button>
        </Stack>
      </form>
    </AuthCard>
  )
}
