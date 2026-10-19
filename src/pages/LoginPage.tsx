import { Button, Input } from '@camply/ui'
import { LogIn } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AuthCard } from '@/components/AuthCard'
import { refusalMessage } from '@/lib/account'
import { authCall, authClient } from '@/lib/auth'
import { openSession } from '@/store/account'

/**
 * L'adresse où revenir : une page du site (« /achats »), jamais un autre site (« //exemple.fr »,
 * « /\exemple.fr », que le navigateur lit comme « //exemple.fr ») : elle doit rester sur le site.
 */
const returnPath = (path: string | null) =>
  path?.startsWith('/') && new URL(path, location.origin).origin === location.origin ? path : '/'

/**
 * `/connexion` : se connecter par son pseudo pour ouvrir son Pokédex, hors de la coquille (elle ne
 * s'ouvre que connecté), la page d'un visiteur qui ouvre le site ; sans compte, l'inscription
 * (`SignUpPage`). Ensuite, retour à la page d'où l'on venait (`?retour=`), l'accueil sinon.
 */
export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const problem = await openSession(
      await authCall(() => authClient.signIn.username({ username: pseudo.trim(), password })),
      (refused) =>
        refusalMessage(
          { 401: 'Pseudo ou mot de passe incorrect.' },
          refused,
          'Connexion impossible pour le moment : réessayez plus tard.',
        ),
    )
    setBusy(false)
    if (problem) setError(problem)
    else navigate(returnPath(params.get('retour')), { replace: true })
  }

  return (
    <AuthCard
      title="Connexion"
      description="Pour ouvrir votre Pokédex : votre collection, vos achats et votre budget, les mêmes sur tous vos appareils."
      error={error}
      onSubmit={submit}
      other={{ to: '/inscription', label: 'Pas encore de compte ? En créer un' }}
    >
      <Input
        label="Pseudo"
        autoComplete="username"
        required
        value={pseudo}
        onChange={(event) => setPseudo(event.target.value)}
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
    </AuthCard>
  )
}
