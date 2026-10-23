import { useReducer, useTransition } from 'react'
import { forget } from '@/lib/api'

/**
 * « Réessayer » une réponse de l'API qui manquait (`url`, lue par `use()`) : oubliée, puis
 * redemandée ; le message reste, son bouton en chargement, jusqu'à la nouvelle réponse (une
 * transition). Le Catalogue et sa fenêtre des extensions (`Unavailable`).
 */
export function useRetry(url: string) {
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const [retrying, startRetry] = useTransition()
  const onRetry = () =>
    startRetry(() => {
      forget(url)
      rerender()
    })
  return { retrying, onRetry }
}
