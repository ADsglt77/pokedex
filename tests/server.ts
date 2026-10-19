/**
 * La base du serveur pour les tests : dans le dossier temporaire de `setup.ts`, jamais `.data`.
 * La garde est ici, une fois : sans `setup.ts` (`bun test` lancé hors du projet), `DATA_DIR`
 * reviendrait à `.data`, et rien n'est ouvert. Better Auth prépare ses requêtes sans les libérer :
 * la base ne lâche son fichier qu'une fois elles ramassées (Windows refuserait sinon de le retirer).
 */

import { afterAll } from 'bun:test'
import { tmpdir } from 'node:os'
import { DATA_DIR, openApp } from '../server/db'

if (!DATA_DIR.startsWith(tmpdir())) throw new Error(`DATA_DIR n’est pas temporaire : ${DATA_DIR}`)

/** La base des comptes et des collections, fermée après les tests du fichier. */
export function testApp() {
  const app = openApp()
  afterAll(() => {
    app.close()
    Bun.gc(true)
  })
  return app
}
