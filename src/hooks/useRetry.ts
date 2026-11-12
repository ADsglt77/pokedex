import { useReducer, useTransition } from 'react'
import { forget } from '@/lib/api'

/**
 * « Réessayer » une réponse de l'API qui manquait, lue par `use()` : celle de `answer` (une
 * adresse, `forget`), ou ce qu'oublie `answer` (une fonction : les historiques de la collection),
 * puis redemandée ; le message reste, son bouton en chargement, jusqu'à la nouvelle réponse (une
 * transition). Avec `Unavailable` ; les prix du jour : `useRetryPrices`.
 */
export function useRetry(answer: string | (() => void)) {
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const [retrying, startRetry] = useTransition()
  const onRetry = () =>
    startRetry(() => {
      if (typeof answer === 'string') forget(answer)
      else answer()
      rerender()
    })
  return { retrying, onRetry }
}
