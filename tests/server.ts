/**
 * Les bases du serveur pour les tests : dans le dossier temporaire de `setup.ts`, jamais `.data`.
 * La garde est ici, une fois : sans `setup.ts` (`bun test` lancé hors du projet), `DATA_DIR`
 * reviendrait à `.data`, et rien n'est ouvert. Chaque fichier qui en a besoin ouvre les siennes,
 * fermées après ses tests (pour que `setup.ts` retire leur dossier).
 */

import { afterAll } from 'bun:test'
import { tmpdir } from 'node:os'
import { DATA_DIR, openApp, openData } from '../server/db'

if (!DATA_DIR.startsWith(tmpdir())) throw new Error(`DATA_DIR n’est pas temporaire : ${DATA_DIR}`)

/** La base des données de référence (prix, catalogue…), fermée après les tests du fichier. */
export function testData() {
  const data = openData()
  afterAll(() => data.close())
  return data
}

/**
 * Les deux bases, le compte et la collection compris. Better Auth prépare ses requêtes sans les
 * libérer : la base ne lâche son fichier qu'une fois elles ramassées (Windows refuserait sinon de
 * le retirer).
 */
export function testBases() {
  const data = openData()
  const app = openApp()
  afterAll(() => {
    app.close()
    data.close()
    Bun.gc(true)
  })
  return { data, app }
}
