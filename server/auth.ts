/**
 * La connexion (Better Auth) : un compte, le vôtre, par e-mail et mot de passe, dans `app.db`.
 * Pas d'inscription : le compte se crée sur le serveur (`create-user.ts`). Sessions de 60 jours,
 * renouvelées chaque jour d'usage, dans un cookie (`__Secure-`, SameSite Lax, en https).
 *
 * `BETTER_AUTH_URL` : l'adresse publique du site (en développement, celle de Vite :
 * http://localhost:5173), jamais devinée de la requête ; `BETTER_AUTH_SECRET` : la clé qui signe
 * les cookies (`openssl rand -base64 32`). Les deux sont exigées en production.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import type { Database } from 'bun:sqlite'

const DAY = 24 * 60 * 60

/**
 * La connexion, une fois créées les tables du compte qui manquent. `signUp` : seulement pour
 * `create-user.ts`, qui crée le compte.
 */
export async function createAuth(db: Database, { signUp = false } = {}) {
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, disableSignUp: !signUp },
    session: { expiresIn: 60 * DAY, updateAge: DAY },
    // Derrière le tunnel Cloudflare et nginx (qui n'écoute que sur la machine), l'adresse du
    // visiteur est dans cet en-tête : la limite de tentatives vaut pour lui, pas pour le tunnel.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // En production : 5 tentatives de connexion par minute, 100 requêtes pour le reste.
    rateLimit: { window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 5 } } },
  } satisfies BetterAuthOptions
  await (await getMigrations(options)).runMigrations()
  return betterAuth(options)
}

export type Auth = Awaited<ReturnType<typeof createAuth>>

/** L'origine publique du site, que doivent avoir les requêtes qui modifient la collection. */
export const appOrigin = (auth: Auth) => new URL(auth.options.baseURL as string).origin
