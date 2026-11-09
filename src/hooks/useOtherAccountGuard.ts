import { useRef } from 'react'
import { hasChangesAtRisk, useAccountStore } from '@/store/account'

/**
 * Avant d'ouvrir un autre compte (connexion, inscription) quand celui resté ici (sa session fermée)
 * perdrait quelque chose : une modification pas encore enregistrée, une version mise de côté pas
 * exportée. Rend le refus du premier envoi (l'encadré au-dessus du formulaire, `PendingChangesNotice`,
 * propose l'export), `null` ensuite : le second passe. Le même pseudo (n'importe quelles majuscules)
 * passe toujours, rien n'est quitté (`signIn`) ; `pseudo` vaut `null` pour un nouveau compte.
 */
export function useOtherAccountGuard() {
  const warned = useRef(false)
  return (pseudo: string | null) => {
    const { account } = useAccountStore.getState()
    if (!account || warned.current || !hasChangesAtRisk()) return null
    if (pseudo !== null && pseudo.trim().toLowerCase() === account.name.toLowerCase()) return null
    warned.current = true
    return `Ce qui n’est pas enregistré de «\u00a0${account.name}\u00a0» serait perdu avec un autre compte\u00a0: exportez-le ci-dessus, ou envoyez à nouveau pour continuer quand même.`
  }
}
