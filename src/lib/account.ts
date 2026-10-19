/**
 * La connexion côté navigateur : le serveur du site (`/api/account`, `server/auth.ts`). La session
 * vit dans un cookie ; qui est connecté se lit une fois au démarrage (`loadAccount`), puis le store
 * du compte le suit (`store/account.ts`) ; la règle du pseudo (`isPseudo`) ; et les messages d'un refus
 * (`refusalMessage`). Lu par le premier affichage : le client Better Auth, plus lourd, est à part
 * (`auth.ts`).
 */

import { PSEUDO, RESERVED_PSEUDOS } from '@/config/account'
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

/** Un pseudo réservé au site (le premier segment d'une de ses adresses : `RESERVED_PSEUDOS`) ? */
export const reservedPseudo = (value: string) => RESERVED_PSEUDOS.includes(value.toLowerCase())

/** Ce que dit un formulaire d'un pseudo réservé. */
export const PSEUDO_RESERVED = 'Ce pseudo est une adresse du site : choisissez-en un autre.'

const PSEUDO_RULE = new RegExp(`^${PSEUDO.pattern}$`)

/**
 * Un pseudo possible (`PSEUDO`) : sa longueur, ses caractères, et pas une adresse du site. La règle
 * du serveur (`server/auth.ts`) et du routeur (`vitrinePseudo`).
 */
export const isPseudo = (value: string) =>
  value.length >= PSEUDO.min &&
  value.length <= PSEUDO.max &&
  PSEUDO_RULE.test(value) &&
  !reservedPseudo(value)

/** La page de connexion, qui ramène ensuite à `back` (une page du site, filtres compris). */
export const loginPath = (back: string) => `/connexion?retour=${encodeURIComponent(back)}`

/** Le compte d'une réponse de Better Auth (connexion, création) : son id et son pseudo. */
export const accountOf = ({ id, name }: AccountUser): AccountUser => ({ id, name })

/**
 * Une seule requête au démarrage : qui est connecté. Rend le compte connecté sur ce navigateur :
 * `null` personne, `undefined` sans réponse du serveur en 15 s (l'app ne peut pas s'afficher).
 * `?demarrage` : la demande que `index.html` précharge.
 */
export async function loadAccount(): Promise<AccountUser | null | undefined> {
  try {
    const response = await fetch('/api/account?demarrage', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return
    return ((await response.json()) as AccountState).user
  } catch {
    // Serveur arrêté ou bloqué.
  }
}
