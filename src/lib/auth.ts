/**
 * Le client Better Auth : connexion, création du compte, déconnexion, mot de passe et pseudo, par
 * le serveur du site (`/api/auth`, `server/auth.ts`). À part de `account.ts`, que lit le premier
 * affichage : seules les pages qui s'en servent le chargent (connexion, première visite, Données ›
 * Mon compte), et la déconnexion à la demande (`store/sync.ts`). Le client simple : l'app ne se sert
 * d'aucun de ses hooks React.
 */

import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient()

/**
 * Une action du compte, sa réponse telle que la donne le client ; sans réponse du serveur (hors
 * ligne, serveur arrêté), un refus de statut 0.
 */
export const authCall = <R>(call: () => Promise<R>) =>
  call().catch(() => ({ data: null, error: { status: 0 } }) as const)
