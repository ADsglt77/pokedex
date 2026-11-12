import { IconButton } from '@camply/ui'
import { Eye, EyeOff } from '@camply/ui/icons'
import { useState } from 'react'

/**
 * « Afficher le mot de passe » d'un champ des pages du compte (connexion, inscription ; camply n'en
 * a pas) : son `type` et son bouton (`rightIcon`), à passer au champ. Le compte ne se récupère pas
 * sans son mot de passe : on peut relire ce qu'on tape. Le bouton garde son nom ; `aria-pressed`
 * dit s'il est affiché.
 */
export function usePasswordReveal() {
  const [shown, setShown] = useState(false)
  return {
    type: shown ? 'text' : 'password',
    rightIcon: (
      <IconButton
        label="Afficher le mot de passe"
        size="sm"
        variant="ghost"
        aria-pressed={shown}
        onClick={() => setShown(!shown)}
      >
        {shown ? <EyeOff size={14} /> : <Eye size={14} />}
      </IconButton>
    ),
  }
}
