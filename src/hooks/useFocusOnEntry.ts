import { useEffect, type RefObject } from 'react'

// La première page du document (sa clé dans l'historique), et si on l'a quittée depuis.
let firstKey: string | undefined
let moved = false

/**
 * Le focus quand une page en remplace une autre au lieu de s'y ajouter : la coquille, une page du
 * compte (`AuthCard`), une page seule (`StandalonePage`), la page d'erreur (`ErrorPage`). Après la
 * connexion, la déconnexion, un lien vers les mentions légales ou le retour, le bouton ou le lien
 * suivi a disparu avec l'ancienne page, et le focus tomberait sur `body` : il va au contenu
 * (`main`, `tabIndex={-1}`). Sauf sur la toute première page du document (le navigateur le laisse
 * en haut : dans la coquille, le lien d'évitement d'abord), et sauf s'il est déjà ailleurs (un
 * champ, une fenêtre ouverte d'emblée : `?carte=`). Au montage seulement : dans la coquille, chaque
 * changement de page a son propre effet (`AppShell`). La page se reconnaît à la clé de son entrée
 * d'historique, lue dans `history.state` (posée sur chaque entrée : `main.tsx`, le routeur) plutôt
 * que par `useLocation`, qui redessinerait la coquille à chaque frappe d'une recherche gardée dans
 * l'adresse.
 */
export function useFocusOnEntry(main: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const key = (history.state as { key?: string } | null)?.key
    firstKey ??= key
    if (key !== firstKey) moved = true
    const focused = document.activeElement
    if (moved && (!focused || focused === document.body))
      main.current?.focus({ preventScroll: true })
  }, [main])
}
