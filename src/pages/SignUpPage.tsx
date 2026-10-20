import { Input } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthCard } from '@/components/AuthCard'
import { NEW_PASSWORD_FIELD, PASSWORD_MIN, PSEUDO_FIELD, PSEUDO_HINT } from '@/config/account'
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

  const submit = async () => {
    if (reservedPseudo(pseudo)) return PSEUDO_RESERVED
    // L'e-mail, que Better Auth exige : le serveur en donne une sans boîte au compte.
    const problem = await openSession(
      await authCall(() =>
        authClient.signUp.email({ name: pseudo, username: pseudo, email: '', password }),
      ),
      (refused) =>
        refusalMessage(
          {
            400: `Vérifiez le pseudo (${PSEUDO_HINT}) et le mot de passe (${PASSWORD_MIN} caractères au moins).`,
          },
          refused,
          'Création impossible pour le moment : réessayez plus tard.',
        ),
    )
    if (!problem) navigate('/', { replace: true })
    return problem
  }

  return (
    <AuthCard
      title="Créer un compte"
      description="Votre Pokédex de cartes japonaises : votre collection, vos achats et votre budget, les mêmes sur tous vos appareils (un seul connecté à la fois), et un Pokédex public à partager."
      submit={{ label: 'Créer mon compte', icon: <UserPlus size={16} /> }}
      onSubmit={submit}
      other={{ to: '/connexion', label: 'Déjà un compte ? Se connecter' }}
    >
      <Input
        {...PSEUDO_FIELD}
        hint={`${PSEUDO_HINT} Votre Pokédex public sera à l’adresse ${location.host}/${pseudo.toLowerCase() || 'pseudo'}.`}
        value={pseudo}
        onChange={(event) => setPseudo(event.target.value.trim())}
      />
      <Input
        {...NEW_PASSWORD_FIELD}
        label="Mot de passe"
        hint={`${NEW_PASSWORD_FIELD.hint} Le site n’envoie pas d’e-mail : sans votre mot de passe, le compte ne se récupère pas.`}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
    </AuthCard>
  )
}
