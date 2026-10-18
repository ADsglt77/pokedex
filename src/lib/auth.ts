/**
 * Le client Better Auth : connexion, création du compte, déconnexion, mot de passe et pseudo, par
 * le serveur du site (`/api/auth`, `server/auth.ts`). À part de `auth-client.ts`, que lit le
 * premier affichage : seules les pages qui s'en servent le chargent (connexion, première visite,
 * Données › Mon compte), et la déconnexion à la demande (`store/sync.ts`).
 */

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
