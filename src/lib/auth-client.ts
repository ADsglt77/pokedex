/**
 * La connexion côté navigateur (client Better Auth) : le serveur du site, `/api/auth`
 * (`server/auth.ts`). La session vit dans un cookie ; `useSession` dit qui est connecté.
 */

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

/**
 * Le site a-t-il son compte ? Sinon, c'est la première visite : toute page mène à `/bienvenue`,
 * qui le crée. Lu au démarrage (`loadAccount`) ; sans réponse du serveur, on le suppose créé.
 */
export let accountExists = true

export async function loadAccount() {
  try {
    const response = await fetch('/api/account', { cache: 'no-store' })
    if (response.ok) accountExists = ((await response.json()) as { exists: boolean }).exists
  } catch {
    // Serveur arrêté : l'app s'affiche comme si le compte existait.
  }
}

/** Le compte vient d'être créé (`/bienvenue`). */
export function accountCreated() {
  accountExists = true
}
