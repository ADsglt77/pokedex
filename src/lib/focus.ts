/**
 * Le focus au clavier : où il va quand une action retire son propre bouton d'une liste
 * (`keepFocusInList`), et quand un raccourci de la page ne s'applique pas (`shortcutBlocked`).
 */

import type { RefObject } from 'react'
import { flushSync } from 'react-dom'

/**
 * Une action qui retire ou déplace l'élément `index` d'une liste (`ul`) : le focus va au premier
 * bouton, sinon lien, de l'élément qui prend sa place (du dernier si c'était lui), sinon à
 * `fallback`. Le bouton d'abord : le titre d'une carte est un lien, avant ses boutons, et Entrée
 * sur lui quitterait la page. Sans quoi le bouton qui disparaît laisse le focus au document.
 * L'action passe par `flushSync` : la liste est déjà à jour quand on y cherche. Des `ref` : lues
 * au moment de l'action, pas du rendu.
 */
export function keepFocusInList(
  list: RefObject<HTMLElement | null>,
  index: number,
  action: () => void,
  fallback: RefObject<HTMLElement | null>,
) {
  flushSync(action)
  const items = list.current ? [...list.current.children] : []
  const item = items[Math.min(index, items.length - 1)]
  const target =
    item?.querySelector<HTMLElement>('button:not(:disabled)') ??
    item?.querySelector<HTMLElement>('a[href]') ??
    fallback.current
  target?.focus()
}

/**
 * Un raccourci clavier de la page ne s'applique pas : on tape dans un champ (ou une liste de
 * choix), une fenêtre est ouverte, un réglage s'est déjà servi de la touche, ou Ctrl, ⌘ ou Alt est
 * tenu (Maj non : « / » la demande sur certains claviers).
 */
export const shortcutBlocked = (event: KeyboardEvent) =>
  (event.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [role=listbox]') !== null) ||
  event.defaultPrevented ||
  event.ctrlKey ||
  event.metaKey ||
  event.altKey ||
  document.querySelector('[role=dialog]') !== null
