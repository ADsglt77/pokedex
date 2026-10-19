import { Alert, Button, Input, Stack } from '@camply/ui'
import { LogIn } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authCall, authClient } from '@/lib/auth'
import { refusalMessage } from '@/lib/account'
import { pageTitle } from '@/lib/format'
import { signIn } from '@/store/sync'
import { AuthCard } from '@/components/AuthCard'
import styles from './AuthPage.module.css'

/**
 * L'adresse où revenir : une page du site (« /achats »), jamais un autre site (« //exemple.fr »,
 * « /\exemple.fr », que le navigateur lit comme « //exemple.fr ») : elle doit rester sur le site.
 */
const returnPath = (path: string | null) =>
  path?.startsWith('/') && new URL(path, location.origin).origin === location.origin ? path : '/'

/** Le message d'un échec de connexion, d'après la réponse du serveur. */
const failure = (status: number) =>
  refusalMessage(
    { 401: 'E-mail ou mot de passe incorrect.' },
    status,
    'Connexion impossible pour le moment : réessayez plus tard.',
  )

/**
 * `/connexion` : se connecter pour ouvrir son Pokédex, hors de la coquille (elle ne s'ouvre que
 * connecté). Pas d'inscription : le seul compte se crée à la première visite (`WelcomePage`).
 * Ensuite, retour à la page d'où l'on venait (`?retour=`), l'accueil sinon.
 */
export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const back = returnPath(params.get('retour'))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: refused } = await authCall(() =>
      authClient.signIn.email({ email: email.trim(), password }),
    )
    setBusy(false)
    if (refused || !data) return setError(failure(refused?.status ?? 0))
    signIn(data.user)
    navigate(back, { replace: true })
  }

  return (
    <AuthCard
      title="Connexion"
      description="Pour ouvrir votre Pokédex : votre collection, vos achats et votre budget, les mêmes sur tous vos appareils."
    >
      <title>{pageTitle('Connexion')}</title>
      <form onSubmit={submit} className={styles.form}>
        <Stack gap={4}>
          {error && <Alert tone="danger" title={error} />}
          <Input
            label="E-mail"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" fullWidth loading={busy} leftIcon={<LogIn size={16} />}>
            Se connecter
          </Button>
        </Stack>
      </form>
      <Link to="/vitrine" className={styles.back}>
        Voir le Pokédex public
      </Link>
    </AuthCard>
  )
}
