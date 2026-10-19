import { Button, Input } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AuthCard } from '@/components/AuthCard'
import { PSEUDO, PSEUDO_HINT } from '@/config/account'
import { PSEUDO_RESERVED, refusalMessage, reservedPseudo } from '@/lib/account'
import { authCall, authClient } from '@/lib/auth'
import { openSession } from '@/store/account'

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
    const problem = await openSession(
      await authCall(() =>
        authClient.signUp.email({ name: pseudo, username: pseudo, email: '', password }),
      ),
      (refused) =>
        refusalMessage(
          {
            400: `Vérifiez le pseudo (${PSEUDO_HINT}) et le mot de passe (8 caractères au moins).`,
          },
          refused,
          'Création impossible pour le moment : réessayez plus tard.',
        ),
    )
    setBusy(false)
    if (problem) setError(problem)
    else navigate('/', { replace: true })
  }

  return (
    <AuthCard
      title="Créer un compte"
      description="Votre Pokédex de cartes japonaises : votre collection, vos achats et votre budget, les mêmes sur tous vos appareils (un seul connecté à la fois), et un Pokédex public à partager."
      error={error}
      onSubmit={submit}
      other={{ to: '/connexion', label: 'Déjà un compte ? Se connecter' }}
    >
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
    </AuthCard>
  )
}
