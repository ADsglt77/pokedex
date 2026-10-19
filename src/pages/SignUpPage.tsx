import { Alert, Button, Input, Stack } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { PSEUDO, PSEUDO_HINT } from '@/config/account'
import { authCall, authClient } from '@/lib/auth'
import {
  accountOf,
  PSEUDO_RESERVED,
  PSEUDO_TAKEN,
  refusalMessage,
  reservedPseudo,
} from '@/lib/account'
import { pageTitle } from '@/lib/format'
import { signIn } from '@/store/account'
import { AuthCard } from '@/components/AuthCard'
import styles from './AuthPage.module.css'

/** Le message d'un refus, d'après la réponse du serveur. */
const failure = (status: number, code?: string) =>
  code === PSEUDO_TAKEN
    ? 'Ce pseudo est déjà pris : choisissez-en un autre.'
    : refusalMessage(
        { 400: `Vérifiez le pseudo (${PSEUDO_HINT}) et le mot de passe (8 caractères au moins).` },
        status,
        'Création impossible pour le moment : réessayez plus tard.',
      )

/**
 * `/inscription` : créer son compte, hors de la coquille : un pseudo (son Pokédex public sera à
 * `/pseudo` ; pas une adresse du site) et un mot de passe, sans e-mail (`server/auth.ts`). Puis,
 * connecté, l'accueil.
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (reservedPseudo(pseudo)) return setError(PSEUDO_RESERVED)
    setBusy(true)
    setError(null)
    // L'e-mail, que Better Auth exige : le serveur en donne une sans boîte au compte.
    const { data, error: refused } = await authCall(() =>
      authClient.signUp.email({ name: pseudo, username: pseudo, email: '', password }),
    )
    const loaded = !refused && data && (await signIn(accountOf(data.user)))
    setBusy(false)
    if (refused || !data) return setError(failure(refused?.status ?? 0, refused?.code))
    if (!loaded)
      return setError(
        'Connecté, mais votre collection n’a pas pu être lue : réessayez dans un instant.',
      )
    navigate('/', { replace: true })
  }

  return (
    <AuthCard
      title="Créer un compte"
      description="Votre Pokédex de cartes japonaises : votre collection, vos achats et votre budget, les mêmes sur tous vos appareils (un seul connecté à la fois), et un Pokédex public à partager."
    >
      <title>{pageTitle('Créer un compte')}</title>
      <form onSubmit={submit} className={styles.form}>
        <Stack gap={4}>
          {error && <Alert tone="danger" title={error} />}
          <Input
            label="Pseudo"
            hint={`${PSEUDO_HINT} Votre Pokédex public sera à l’adresse ${location.host}/${pseudo.toLowerCase() || 'pseudo'}.`}
            autoComplete="username"
            minLength={PSEUDO.min}
            maxLength={PSEUDO.max}
            pattern={PSEUDO.pattern}
            required
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value.trim())}
          />
          <Input
            label="Mot de passe"
            hint="8 caractères au moins. Le site n’envoie pas d’e-mail : sans votre mot de passe, le compte ne se récupère pas."
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
      <Link to="/connexion" className={styles.back}>
        Déjà un compte ? Se connecter
      </Link>
    </AuthCard>
  )
}
