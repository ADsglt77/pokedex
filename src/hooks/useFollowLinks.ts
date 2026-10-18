import { useCallback, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'

/**
 * Le clic d'une longue liste de liens simples (`<a href>` : les pochettes du Pokédex, les cartes de
 * la liste d'achats), lu une fois pour toute la liste : un clic ordinaire (Entrée au clavier en est
 * un) passe par le routeur, sans recharger la page ; avec Ctrl, ⌘, Maj ou Alt, le navigateur fait
 * comme pour tout lien (nouvel onglet…). Des liens simples, pas des `Link` de react-router : ceux-ci
 * lisent l'adresse, et des centaines se redessineraient à chaque frappe d'une recherche gardée dans
 * l'adresse (environ 20 ms).
 */
export function useFollowLinks() {
  const navigate = useNavigate()
  return useCallback(
    (event: MouseEvent) => {
      const link = (event.target as Element).closest('a')
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        link.target ||
        link.hasAttribute('download') ||
        // Un lien vers un autre site (Cardmarket) : le navigateur l'ouvre lui-même.
        link.origin !== location.origin
      ) {
        return
      }
      event.preventDefault()
      void navigate(link.getAttribute('href')!)
    },
    [navigate],
  )
}
