/**
 * La connexion côté navigateur (client Better Auth) : le serveur du site, `/api/auth`
 * (`server/auth.ts`). La session vit dans un cookie ; qui est connecté se lit une fois au démarrage
 * (`loadAccount`, avec l'existence du compte), puis le store de la synchronisation le suit.
 */

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

/** La page de connexion, qui ramène ensuite à `back` (une page du site, filtres compris). */
export const loginPath = (back: string) => `/connexion?retour=${encodeURIComponent(back)}`

/** Le compte connecté : son id, son e-mail, son pseudo. */
export interface AccountUser {
  id: string
  email: string
  name: string
}

/**
 * Le site a-t-il son compte ? Sinon, c'est la première visite : toute page mène à `/bienvenue`,
 * qui le crée. Lu au démarrage (`loadAccount`) ; sans réponse du serveur (ou pas en 15 s : le
 * premier affichage l'attend), on le suppose créé.
 */
export let accountExists = true

/**
 * Le compte connecté sur ce navigateur au démarrage : `null` personne, `undefined` sans réponse du
 * serveur (hors ligne : `startSession` reprend alors celui de la dernière synchronisation).
 */
export let startupAccount: AccountUser | null | undefined

/** Une seule requête au démarrage : le compte existe-t-il, et qui est connecté. */
export async function loadAccount() {
  try {
    const response = await fetch('/api/account', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return
    const body = (await response.json()) as { exists: boolean; user: AccountUser | null }
    accountExists = body.exists
    startupAccount = body.user
  } catch {
    // Serveur arrêté ou bloqué : l'app s'affiche comme si le compte existait.
  }
}

/** Le compte vient d'être créé (`/bienvenue`). */
export function accountCreated() {
  accountExists = true
}
