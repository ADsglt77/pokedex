/**
 * La connexion côté navigateur : le serveur du site (`/api/account`, `server/auth.ts`). La session
 * vit dans un cookie ; qui est connecté se lit une fois au démarrage (`loadAccount`, avec
 * l'existence du compte), puis le store de la synchronisation le suit. Lu par le premier
 * affichage : le client Better Auth, plus lourd, est à part (`auth.ts`).
 */

import type { AccountState, AccountUser } from '@/types'

/** Trop de tentatives (5 par minute, `server/auth.ts`) : la réponse 429 du serveur. */
export const TOO_MANY_ATTEMPTS = 'Trop de tentatives : réessayez dans une minute.'

/** La page de connexion, qui ramène ensuite à `back` (une page du site, filtres compris). */
export const loginPath = (back: string) => `/connexion?retour=${encodeURIComponent(back)}`

/**
 * Le site a-t-il son compte ? Sinon, c'est la première visite : toute page mène à `/bienvenue`,
 * qui le crée. Lu au démarrage (`loadAccount`) ; sans réponse du serveur (ou pas en 15 s : le
 * premier affichage l'attend), on le suppose créé.
 */
export let accountExists = true

/**
 * Une seule requête au démarrage : le compte existe-t-il, et qui est connecté. Rend le compte
 * connecté sur ce navigateur : `null` personne, `undefined` sans réponse du serveur en `timeout` ms
 * (hors ligne : `startSession` reprend alors celui de la dernière synchronisation). `?demarrage` :
 * la demande que `index.html` précharge, et que le service worker partage avec celle-ci.
 */
export async function loadAccount(timeout: number): Promise<AccountUser | null | undefined> {
  try {
    const response = await fetch('/api/account?demarrage', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    })
    if (!response.ok) return
    const body = (await response.json()) as AccountState
    accountExists = body.exists
    return body.user
  } catch {
    // Serveur arrêté ou bloqué : l'app s'affiche comme si le compte existait.
  }
}

/** Le compte vient d'être créé (`/bienvenue`). */
export function accountCreated() {
  accountExists = true
}
