/**
 * Avant le premier fichier de test (`bunfig.toml`) : l'environnement du serveur. `server/db.ts` lit
 * son dossier (`DATA_DIR`) et `server/auth.ts` l'adresse du compte (`ACCOUNT_EMAIL`) à leur
 * chargement, et `bun test` ne charge un module qu'une fois pour tous les fichiers, dans un ordre
 * imprévisible (`vitrine.test.ts` charge déjà `server/db.ts`) : posées par un fichier de test, ces
 * variables arriveraient parfois trop tard. Un dossier temporaire, retiré à la fin, jamais `.data` ;
 * un compte d'essai, à la place de celui du `.env` (que `bun test` lit aussi).
 */

import { afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'pokedex-tests-'))
process.env.DATA_DIR = dir
process.env.BETTER_AUTH_URL = 'http://localhost:5173'
process.env.BETTER_AUTH_SECRET = 'cle-d-essai-pour-les-tests-du-serveur-seulement'
process.env.ACCOUNT_EMAIL = 'sacha@exemple.fr'

afterAll(() => rmSync(dir, { recursive: true, force: true }))
