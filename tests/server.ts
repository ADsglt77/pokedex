/**
 * Le serveur entier (`createApp`) pour les tests qui le traversent, sur la base de l'app dans le
 * dossier temporaire de `setup.ts`, et des comptes créés comme à l'inscription. Chaque fichier de
 * test ouvre le sien (`openServer`), fermé à sa fin.
 */

import { afterAll } from 'bun:test'
import { tmpdir } from 'node:os'
import { createApp } from '../server/app'
import { createAuth } from '../server/auth'
import { DATA_DIR, openApp } from '../server/db'

// Les bases dans le dossier temporaire de `setup.ts`, jamais `.data` : sans lui (`bun test` lancé
// hors du projet), `DATA_DIR` reviendrait à `.data`, et rien n'est ouvert.
if (!DATA_DIR.startsWith(tmpdir())) throw new Error(`DATA_DIR n’est pas temporaire : ${DATA_DIR}`)

export const ORIGIN = process.env.BETTER_AUTH_URL!

export const PASSWORD = 'mot-de-passe-d-essai'

/**
 * Le serveur, sur la base de l'app (fermée à la fin du fichier qui l'ouvre) ; une action du compte
 * (`authCall` : `/api/auth/…`, du site, avec la session `cookie`) ; un compte créé comme à
 * l'inscription (`createAccount` : le pseudo deux fois, l'e-mail vide, le serveur en donne une),
 * avec sa réponse, son id et la session ouverte avec lui.
 */
export async function openServer() {
  const app = openApp()
  // Better Auth prépare ses requêtes sans les libérer : la base ne lâche son fichier qu'une fois
  // elles ramassées (Windows refuserait sinon de le retirer).
  afterAll(() => {
    app.close()
    Bun.gc(true)
  })
  const server = createApp({ app, accounts: await createAuth(app) })

  const authCall = (path: string, body: unknown, cookie = '') =>
    server.handle(
      new Request(`${ORIGIN}/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
        body: JSON.stringify(body),
      }),
    )

  async function createAccount(pseudo: string) {
    const response = await authCall('sign-up/email', {
      name: pseudo,
      username: pseudo,
      email: '',
      password: PASSWORD,
    })
    const body = (await response.clone().json()) as { user?: { id: string; email: string } }
    const cookie = response.headers
      .getSetCookie()
      .map((line) => line.split(';')[0])
      .join('; ')
    return { response, user: body.user, cookie }
  }

  return { app, server, authCall, createAccount }
}
