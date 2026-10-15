import type { RefObject } from 'react'
import { flushSync } from 'react-dom'

/**
 * Une action qui retire ou déplace l'élément `index` d'une liste (`ul`) : le focus va au premier
 * bouton (ou lien) de l'élément qui prend sa place, du dernier si c'était lui, sinon à `fallback`.
 * Sans quoi le bouton qui disparaît laisse le focus au document. L'action passe par `flushSync` :
 * la liste est déjà à jour quand on y cherche. Des `ref` : lues au moment de l'action, pas du rendu.
 */
export function keepFocusInList(
  list: RefObject<HTMLElement | null>,
  index: number,
  action: () => void,
  fallback?: RefObject<HTMLElement | null>,
) {
  flushSync(action)
  const items = list.current ? [...list.current.children] : []
  const item = items[Math.min(index, items.length - 1)]
  const target =
    item?.querySelector<HTMLElement>('button:not(:disabled), a[href]') ?? fallback?.current
  target?.focus()
}
