/**
 * Avant le premier fichier de test (`bunfig.toml`) : l'environnement du serveur. `server/db.ts` lit
 * son dossier (`DATA_DIR`) à son chargement, et `bun test` ne charge un module qu'une fois pour
 * tous les fichiers, dans un ordre imprévisible (`vitrine.test.ts` charge déjà `server/db.ts`) :
 * posées par un fichier de test, ces variables arriveraient parfois trop tard. Un dossier
 * temporaire, retiré à la fin, jamais `.data` ; l'adresse et la clé du site, à la place de celles
 * du `.env` (que `bun test` lit aussi).
 */

import { afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'pokedex-tests-'))
process.env.DATA_DIR = dir
// Les sauvegardes aussi : jamais celles du `.env`. L'API des données : aucune (le Pokédex public
// en demande les prix à une fausse, `collection.test.ts`).
process.env.BACKUP_DIR = join(dir, 'backups')
process.env.DATA_API_URL = 'http://127.0.0.1:9'
process.env.DATA_API_TOKEN = 'token-d-essai'
process.env.BETTER_AUTH_URL = 'http://localhost:5173'
process.env.BETTER_AUTH_SECRET = 'cle-d-essai-pour-les-tests-du-serveur-seulement'

afterAll(() => rmSync(dir, { recursive: true, force: true }))
