/**
 * `/api/invitations` : les invitations à créer un compte, pour un administrateur seulement (403
 * sinon). L'inscription en exige une (`auth.ts`) : c'est le seul moyen d'ouvrir un compte.
 * - `GET` : les invitations, des plus récentes aux plus anciennes ;
 * - `POST` : une nouvelle, valable 7 jours, pour une seule inscription ;
 * - `DELETE /api/invitations/:token` : retire une invitation pas encore utilisée.
 */

import type { Database } from 'bun:sqlite'
import { appOrigin, type Auth, type Role } from './auth'

const WEEK = 7 * 86_400_000

export interface Invitation {
  token: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedEmail: string | null
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export function invitationRoutes(app: Database, auth: Auth) {
  /** L'administrateur de la requête ; une réponse d'erreur sinon. */
  const admin = async (request: Request, { writes = false } = {}) => {
    if (writes && request.headers.get('origin') !== appOrigin(auth)) return json(null, 403)
    const user = (await auth.api.getSession({ headers: request.headers }))?.user as
      { id: string; role?: Role } | undefined
    if (!user) return json(null, 401)
    return user.role === 'admin' ? user : json(null, 403)
  }

  return {
    list: {
      async GET(request: Request) {
        const user = await admin(request)
        if (user instanceof Response) return user
        return json(
          app
            .query(
              `SELECT token, created_at AS createdAt, expires_at AS expiresAt, used_at AS usedAt,
                      used_email AS usedEmail
               FROM invitations ORDER BY created_at DESC`,
            )
            .all() as Invitation[],
        )
      },
      async POST(request: Request) {
        const user = await admin(request, { writes: true })
        if (user instanceof Response) return user
        const now = new Date()
        const invitation: Invitation = {
          token: Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url'),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + WEEK).toISOString(),
          usedAt: null,
          usedEmail: null,
        }
        app
          .query(
            'INSERT INTO invitations (token, created_by, created_at, expires_at) VALUES (?, ?, ?, ?)',
          )
          .run(invitation.token, user.id, invitation.createdAt, invitation.expiresAt)
        return json(invitation, 201)
      },
    },
    one: {
      async DELETE(request: Request & { params: { token: string } }) {
        const user = await admin(request, { writes: true })
        if (user instanceof Response) return user
        app
          .query('DELETE FROM invitations WHERE token = ? AND used_at IS NULL')
          .run(request.params.token)
        return json(null)
      },
    },
  }
}
