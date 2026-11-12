import { Input } from '@camply/ui'
import { UserPlus } from '@camply/ui/icons'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthCard } from '@/components/AuthCard'
import { FieldAlert } from '@/components/FieldAlert'
import { NEW_PASSWORD_FIELD, PASSWORD_MIN, PSEUDO_FIELD, PSEUDO_HINT } from '@/config/account'
import { useOtherAccountGuard } from '@/hooks/useOtherAccountGuard'
import { usePasswordReveal } from '@/hooks/usePasswordReveal'
import { isPseudo, pseudoProblem } from '@/lib/account'
import { authCall, authClient } from '@/lib/auth'
import { vitrinePath } from '@/lib/filters'
import { focusAfter } from '@/lib/focus'
import { openSession } from '@/store/account'

/**
 * `/inscription` : créer son compte, hors de la coquille : un pseudo (son Pokédex public sera à
 * `/pseudo` ; pas une adresse du site) et un mot de passe, sans e-mail (`worker/auth.ts`). Puis,
 * connecté, l'accueil. Le pseudo est vérifié à l'envoi (`pseudoProblem`) : un refus s'affiche sous
 * lui, qui reçoit le focus, et il est annoncé (`FieldAlert`) ; l'adresse du Pokédex public n'est
 * montrée que pour un pseudo qui convient. Un compte resté ici avec des modifications à perdre :
 * d'abord un avertissement (`useOtherAccountGuard`).
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const otherAccount = useOtherAccountGuard()
  const reveal = usePasswordReveal()
  const [pseudoError, setPseudoError] = useState<string | null>(null)
  const [refusals, setRefusals] = useState(0)
  const pseudoField = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const problem = pseudoProblem(pseudo)
    if (problem) {
      focusAfter(() => {
        setPseudoError(problem)
        setRefusals((count) => count + 1)
      }, pseudoField)
      return null
    }
    const warning = otherAccount(null)
    if (warning) return warning
    // L'e-mail, que Better Auth exige : le serveur en donne une sans boîte au compte.
    const refused = await openSession(
      await authCall(() =>
        authClient.signUp.email({ name: pseudo, username: pseudo, email: '', password }),
      ),
      {
        400: `Vérifiez le pseudo (${PSEUDO_HINT}) et le mot de passe (${PASSWORD_MIN} caractères au moins).`,
      },
      'Création impossible pour le moment\u00a0: réessayez plus tard.',
    )
    if (!refused) navigate('/', { replace: true })
    return refused
  }

  return (
    <AuthCard
      title="Créer un compte"
      description="Votre Pokédex de cartes japonaises et françaises&nbsp;: votre collection, vos achats et votre budget, les mêmes sur tous vos appareils (un seul connecté à la fois), et un Pokédex public à partager."
      submit={{ label: 'Créer mon compte', icon: <UserPlus size={16} /> }}
      onSubmit={submit}
      other={{ to: '/connexion', label: 'Déjà un compte\u202f? Se connecter' }}
    >
      <Input
        ref={pseudoField}
        {...PSEUDO_FIELD}
        hint={`${PSEUDO_HINT} Votre Pokédex public sera à l’adresse ${location.host}${vitrinePath(isPseudo(pseudo) ? pseudo : 'pseudo')}.`}
        error={pseudoError ?? undefined}
        value={pseudo}
        onChange={(event) => {
          setPseudo(event.target.value.trim())
          setPseudoError(null)
        }}
      />
      <FieldAlert key={refusals}>{pseudoError}</FieldAlert>
      <Input
        {...NEW_PASSWORD_FIELD}
        {...reveal}
        label="Mot de passe"
        hint={`${NEW_PASSWORD_FIELD.hint} Le site n’envoie pas d’e-mail\u00a0: sans votre mot de passe, le compte ne se récupère pas.`}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
    </AuthCard>
  )
}
