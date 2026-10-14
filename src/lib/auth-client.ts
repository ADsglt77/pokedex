/**
 * La connexion côté navigateur (client Better Auth) : le serveur du site, `/api/auth`
 * (`server/auth.ts`). La session vit dans un cookie ; `useSession` dit qui est connecté.
 */

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
