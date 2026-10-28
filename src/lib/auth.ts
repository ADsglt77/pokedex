/**
 * Le client Better Auth : création du compte, connexion par le pseudo, déconnexion, mot de passe,
 * pseudo et suppression du compte, par le serveur du site (`/api/auth`, `worker/auth.ts`). À part
 * de `account.ts`, que lit le premier affichage : seules les pages qui s'en servent le chargent
 * (connexion, inscription, Réglages › Mon compte), et la déconnexion à la demande
 * (`store/account.ts`). Le client simple : l'app ne se sert d'aucun de ses hooks React.
 */

import { createAuthClient } from 'better-auth/client'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({ plugins: [usernameClient()] })

/**
 * Une action du compte, sa réponse telle que la donne le client ; sans réponse du serveur (hors
 * ligne, serveur arrêté), un refus de statut 0.
 */
export const authCall = <R>(call: () => Promise<R>) =>
  call().catch(() => ({ data: null, error: { status: 0, code: undefined } }) as const)
