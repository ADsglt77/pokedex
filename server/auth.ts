/**
 * La connexion (Better Auth) : des comptes par e-mail et mot de passe, dans `app.db`.
 * - L'inscription (`/inscription`) n'accepte qu'une invitation valable (en-tête `X-Invitation`,
 *   table `invitations`) : un administrateur la crée (`invitations.ts`), elle sert une fois, sept
 *   jours au plus. Le premier compte, administrateur, se crée sur le serveur (`create-user.ts`).
 * - Une seule session par compte : se connecter sur un appareil déconnecte les autres. La
 *   collection n'est donc modifiée que d'un appareil à la fois.
 * Sessions de 60 jours, renouvelées chaque jour d'usage, dans un cookie (`__Secure-`, SameSite
 * Lax, en https).
 *
 * `BETTER_AUTH_URL` : l'adresse publique du site (en développement, celle de Vite :
 * http://localhost:5173), jamais devinée de la requête ; `BETTER_AUTH_SECRET` : la clé qui signe
 * les cookies (`openssl rand -base64 32`). Les deux sont exigées en production.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError } from 'better-auth/api'
import { getMigrations } from 'better-auth/db/migration'
import type { Database } from 'bun:sqlite'

const DAY = 24 * 60 * 60

/** Le rôle d'un compte : `admin` (créé par `create-user.ts`, il invite), ou `user`. */
export type Role = 'admin' | 'user'

/**
 * La connexion, une fois créées les tables du compte qui manquent. `trusted` : seulement pour
 * `create-user.ts`, qui crée un compte sans invitation.
 */
export async function createAuth(db: Database, { trusted = false } = {}) {
  const consume = db.query(
    `UPDATE invitations SET used_at = ?, used_email = ?
     WHERE token = ? AND used_at IS NULL AND expires_at > ?`,
  )
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    user: {
      // `input: false` : personne ne se donne un rôle en s'inscrivant.
      additionalFields: { role: { type: 'string', defaultValue: 'user', input: false } },
    },
    session: { expiresIn: 60 * DAY, updateAge: DAY },
    databaseHooks: {
      user: {
        create: {
          // L'invitation est prise au moment de créer le compte : une adresse déjà inscrite est
          // refusée avant, sans la gâcher.
          before: async (user, context) => {
            if (trusted) return
            const token = (context?.headers as Headers | undefined)?.get('x-invitation') ?? ''
            const now = new Date().toISOString()
            if (consume.run(now, user.email, token, now).changes !== 1) {
              throw new APIError('FORBIDDEN', { message: 'Invitation invalide ou expirée' })
            }
          },
        },
      },
      session: {
        create: {
          // Une seule session par compte : les autres appareils sont déconnectés.
          after: async (session) => {
            db.query('DELETE FROM session WHERE userId = ? AND id != ?').run(
              session.userId,
              session.id,
            )
          },
        },
      },
    },
    // Derrière le tunnel Cloudflare et nginx (qui n'écoute que sur la machine), l'adresse du
    // visiteur est dans cet en-tête : la limite de tentatives vaut pour lui, pas pour le tunnel.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // En production : 5 tentatives de connexion ou d'inscription par minute, 100 requêtes pour le
    // reste.
    rateLimit: {
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
  } satisfies BetterAuthOptions
  await (await getMigrations(options)).runMigrations()
  return betterAuth(options)
}

export type Auth = Awaited<ReturnType<typeof createAuth>>

/** L'origine publique du site, que doivent avoir les requêtes qui modifient des données. */
export const appOrigin = (auth: Auth) => new URL(auth.options.baseURL as string).origin
