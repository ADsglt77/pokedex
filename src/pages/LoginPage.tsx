import { Alert, Button, Card, CardDescription, CardHeader, Input, Stack } from '@camply/ui'
import { LogIn } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { pageTitle } from '@/lib/format'
import { sync } from '@/store/sync'
import styles from './AuthPage.module.css'

/** L'adresse où revenir : une page du site (« /achats »), jamais un autre site (« //exemple.fr »). */
const returnPath = (path: string | null) =>
  path?.startsWith('/') && !path.startsWith('//') ? path : '/'

/** Le message d'un échec de connexion, d'après la réponse du serveur. */
const failure = (status: number) =>
  status === 401
    ? 'E-mail ou mot de passe incorrect.'
    : status === 429
      ? 'Trop de tentatives : réessayez dans une minute.'
      : 'Connexion impossible pour le moment : réessayez plus tard.'

/**
 * `/connexion` : se connecter pour retrouver sa collection sur tous ses appareils. Pas
 * d'inscription : le compte se crée sur le serveur (`server/create-user.ts`). Ensuite, retour à la
 * page d'où l'on venait (`?retour=`).
 */
export function LoginPage() {
  const { data: session } = authClient.useSession()
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
    const { error: refused } = await authClient.signIn
      .email({ email: email.trim(), password })
      .catch(() => ({ error: { status: 0 } }))
    setBusy(false)
    if (refused) return setError(failure(refused.status))
    // Après une session expirée, le même compte : la synchronisation reprend.
    void sync()
    navigate(back, { replace: true })
  }

  return (
    <div className={styles.page}>
      <title>{pageTitle('Connexion')}</title>
      <Card padding="lg" className={styles.card}>
        <CardHeader>
          <h1 className={styles.title}>Connexion</h1>
          <CardDescription>
            Pour retrouver votre collection, vos achats et votre budget sur tous vos appareils. Sans
            compte, le Pokédex marche aussi : la collection reste alors dans ce navigateur.
          </CardDescription>
        </CardHeader>
        {session ? (
          <Stack gap={4}>
            <p>Vous êtes connecté avec {session.user.email}.</p>
            <Button asChild>
              <Link to={back}>Continuer</Link>
            </Button>
          </Stack>
        ) : (
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
              <p className="muted">
                Pas de compte ? L’inscription se fait sur invitation : demandez un lien à
                l’administrateur du site.
              </p>
            </Stack>
          </form>
        )}
      </Card>
    </div>
  )
}
