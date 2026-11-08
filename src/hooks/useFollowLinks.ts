import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router'

/**
 * Le dernier lien suivi par `useFollowLinks` : sa page, son adresse, et son rang parmi les liens
 * de cette adresse que le focus peut prendre (`focusableLinks` : deux cartes d'un même Pokémon dans
 * la liste d'achats mènent à la même fiche).
 */
let followed: { from: string; href: string; rank: number } | null = null

/**
 * Les liens de `root` vers `href` que le focus peut prendre, dans l'ordre de la page : affichés
 * (pas ceux du Pokédex gardé caché, ni une pochette filtrée : `display: none`, eux ou un parent,
 * aucune boîte ; pas `checkVisibility`, absent de Safari avant 17.4 : l'erreur emportait toute
 * l'app), et pas une vignette qui double le lien du titre (`tabIndex = -1`, cachée aux lecteurs
 * d'écran).
 */
const focusableLinks = (root: ParentNode, href: string) =>
  [...root.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`)].filter(
    (link) => link.tabIndex >= 0 && link.getClientRects().length > 0,
  )

/**
 * De retour sur la page `pathname` d'où un lien a été suivi (une pochette du Pokédex, une carte de
 * la liste d'achats) : ce lien, s'il est affiché, pour y remettre le focus ; `null` sinon. Une
 * seule fois.
 */
export function returnedLink(root: HTMLElement, pathname: string) {
  if (followed?.from !== pathname) return null
  const { href, rank } = followed
  followed = null
  return focusableLinks(root, href)[rank] ?? null
}

/**
 * Le clic d'une longue liste de liens simples (`<a href>` : les pochettes du Pokédex, les cartes de
 * la liste d'achats), lu une fois pour toute la liste : un clic ordinaire (Entrée au clavier en est
 * un) passe par le routeur, sans recharger la page ; avec Ctrl, ⌘, Maj ou Alt, le navigateur fait
 * comme pour tout lien (nouvel onglet…). Des liens simples, pas des `Link` de react-router : ceux-ci
 * lisent l'adresse, et des centaines se redessineraient à chaque frappe d'une recherche gardée dans
 * l'adresse (environ 20 ms). Le lien suivi est retenu : de retour sur la page, le focus y revient
 * (`returnedLink`, la coquille), au lieu de repartir du haut ; suivi par sa vignette, au lien du
 * titre qu'elle double (le premier qui la suit).
 */
export function useFollowLinks() {
  const navigate = useNavigate()
  return (event: MouseEvent) => {
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
    const href = link.getAttribute('href')!
    const rank = focusableLinks(link.closest('main') ?? document, href).findIndex(
      (other) =>
        other === link ||
        !!(link.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING),
    )
    followed = { from: location.pathname, href, rank: Math.max(rank, 0) }
    void navigate(href)
  }
}
