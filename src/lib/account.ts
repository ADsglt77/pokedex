/**
 * La connexion côté navigateur : le serveur du site (`/api/account`, `server/auth.ts`). La session
 * vit dans un cookie ; qui est connecté se lit une fois au démarrage (`loadAccount`), puis le store
 * de la synchronisation le suit ; et les messages d'un refus (`refusalMessage`). Lu par le premier
 * affichage : le client Better Auth, plus lourd, est à part (`auth.ts`).
 */

import type { AccountState, AccountUser } from '@/types'

/** Trop de tentatives (`server/auth.ts`) : la réponse 429 du serveur. */
const TOO_MANY_ATTEMPTS = 'Trop de tentatives : réessayez un peu plus tard.'

/**
 * Le message d'un refus du serveur, d'après son statut (`messages`, propres au formulaire), trop de
 * tentatives (429), ou `otherwise` pour les autres (0 : pas de réponse).
 */
export const refusalMessage = (
  messages: Partial<Record<number, string>>,
  status: number,
  otherwise: string,
) => messages[status] ?? (status === 429 ? TOO_MANY_ATTEMPTS : otherwise)

/** Le pseudo est déjà celui d'un autre compte : le code du refus de Better Auth. */
export const PSEUDO_TAKEN = 'USERNAME_IS_ALREADY_TAKEN'

/** La page de connexion, qui ramène ensuite à `back` (une page du site, filtres compris). */
export const loginPath = (back: string) => `/connexion?retour=${encodeURIComponent(back)}`

/** Le compte d'une réponse de Better Auth (connexion, création) : son id et son pseudo. */
export const accountOf = ({ id, name }: AccountUser): AccountUser => ({ id, name })

/**
 * Une seule requête au démarrage : qui est connecté. Rend le compte connecté sur ce navigateur :
 * `null` personne, `undefined` sans réponse du serveur en `timeout` ms (hors ligne :
 * `startSession` reprend alors celui de la dernière synchronisation). `?demarrage` : la demande que
 * `index.html` précharge, et que le service worker partage avec celle-ci.
 */
export async function loadAccount(timeout: number): Promise<AccountUser | null | undefined> {
  try {
    const response = await fetch('/api/account?demarrage', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    })
    if (!response.ok) return
    return ((await response.json()) as AccountState).user
  } catch {
    // Serveur arrêté ou bloqué : comme hors ligne.
  }
}
