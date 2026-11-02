import { useEffect, useEffectEvent } from 'react'
import { shortcutBlocked } from '@/lib/focus'

/**
 * Un raccourci clavier de la page tant que le composant est affiché (« / » du Pokédex, ← et → d'une
 * fiche) : `onKeyDown` reçoit chaque touche que `shortcutBlocked` laisse passer, et lit toujours
 * les valeurs du dernier rendu. Un seul écouteur, retiré au démontage.
 */
export function usePageShortcut(onKeyDown: (event: KeyboardEvent) => void) {
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!shortcutBlocked(event)) onKeyDown(event)
  })
  useEffect(() => {
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])
}
