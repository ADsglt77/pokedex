import { Alert, Button, Card, CardDescription, CardHeader, Input, Stack } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { accountCreated, authClient } from '@/lib/auth-client'
import { pageTitle } from '@/lib/format'
import { sync } from '@/store/sync'
import styles from './AuthPage.module.css'

/** Le message d'un refus, d'après la réponse du serveur. */
const failure = (status: number) =>
  status === 403
    ? 'Code incorrect : recopiez celui du journal du serveur (il change à chaque démarrage).'
    : status === 429
      ? 'Trop de tentatives : réessayez dans une minute.'
      : 'Création impossible pour le moment : réessayez plus tard.'

/**
 * `/bienvenue` : la première visite, tant que le site n'a pas de compte (le routeur y mène toute
 * page). On crée le seul compte, avec le code de première visite que le serveur écrit dans son
 * journal (`server/auth.ts`) : seul celui qui lit ce journal peut le créer. Ensuite, connecté, la
 * collection de ce navigateur part sur le compte.
 */
export function WelcomePage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
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
        fetchOptions: { headers: { 'X-Setup-Code': code } },
      })
      .catch(() => ({ error: { status: 0 } }))
    setBusy(false)
    if (refused) return setError(failure(refused.status))
    accountCreated()
    void sync()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <title>{pageTitle('Bienvenue')}</title>
      <Card padding="lg" className={styles.card}>
        <CardHeader>
          <h1 className={styles.title}>Bienvenue</h1>
          <CardDescription>
            Ce Pokédex n’a pas encore de compte : créez le vôtre. Ce sera le seul, personne d’autre
            ne pourra en créer. Il garde votre collection, vos achats et votre budget sur le
            serveur, pour les retrouver sur vos appareils (un seul connecté à la fois).
          </CardDescription>
        </CardHeader>
        <form onSubmit={submit} className={styles.form}>
          <Stack gap={4}>
            {error && <Alert tone="danger" title={error} />}
            <p className="muted">
              Le code de première visite prouve que c’est vous : le serveur l’écrit dans son journal
              au démarrage (<code>docker compose logs server</code>, ou le terminal de{' '}
              <code>bun run dev:server</code>).
            </p>
            <Input
              label="Code de première visite"
              hint="Huit caractères, comme 7KQM-3XPA."
              autoComplete="off"
              spellCheck={false}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
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
      </Card>
    </div>
  )
}
