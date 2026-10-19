/**
 * La base SQLite de l'app, `app.db` dans `DATA_DIR` (`.data/` en local, le volume `db` sur le
 * VPS) : les comptes (Better Auth, `auth.ts`) et les collections synchronisées, écrites par le
 * serveur seulement. Les données de référence (catalogue, prix…) sont à l'API des données (le
 * dépôt `pokedex-data`). Le schéma évolue par étapes (`PRAGMA user_version`) : une étape ajoutée
 * ne modifie jamais les précédentes, déjà appliquées. L'empreinte de chacune est gardée
 * (`schema_steps`) : une étape modifiée après coup (enregistrée à moitié pendant que `bun --watch`
 * relance le serveur), ou une base plus avancée que le code (un code plus ancien redéployé), et le
 * serveur refuse de démarrer.
 */

import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '..', '.data')

/**
 * L'étape qui donne leurs empreintes aux bases d'avant elles (`migrate` les note en appliquant
 * une étape).
 */
const FINGERPRINTS_STEP = `
  -- L'empreinte de chaque étape appliquée (\`migrate\`) : une étape modifiée après coup est refusée.
  CREATE TABLE IF NOT EXISTS schema_steps (step INTEGER PRIMARY KEY, hash TEXT NOT NULL);
  `

/**
 * Les tables de l'app ; celles du compte (`user`, `session`, `account`, `verification`), Better
 * Auth les crée lui-même (`auth.ts`).
 */
export const APP_STEPS = [
  `
  -- La collection et les achats de chaque compte, tels que les enregistre le navigateur (JSON).
  -- \`version\` augmente à chaque enregistrement : un appareil qui envoie une version dépassée est
  -- refusé (il n'écrase pas ce qu'un autre a envoyé entre-temps).
  CREATE TABLE collections (
    user_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    collection TEXT NOT NULL,
    shopping TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Les versions remplacées, au plus une par heure, gardées 30 jours (compressées, gzip) : de quoi
  -- revenir en arrière à la main après une erreur.
  CREATE TABLE collection_versions (
    user_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    saved_at TEXT NOT NULL,
    body BLOB NOT NULL,
    PRIMARY KEY (user_id, version)
  ) WITHOUT ROWID;
  `,
  `
  -- Les invitations à créer un compte : l'inscription n'en accepte pas sans (\`auth.ts\`). Un
  -- administrateur les crée (\`invitations.ts\`) ; chacune sert une fois, avant \`expires_at\`.
  CREATE TABLE invitations (
    token TEXT PRIMARY KEY,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_email TEXT
  );
  `,
  `
  -- Les invitations, retirées : un seul compte, créé à la première visite du site (\`auth.ts\`).
  DROP TABLE invitations;
  `,
  `
  -- Le Pokédex public (\`/vitrine\`, \`vitrine.ts\`) : 1 si le compte montre sa collection.
  ALTER TABLE collections ADD COLUMN public INTEGER NOT NULL DEFAULT 0;
  `,
  `
  -- Le Pokédex public est toujours montré (octobre 2026) : plus de réglage.
  ALTER TABLE collections DROP COLUMN public;
  `,
  FINGERPRINTS_STEP,
  `
  -- Chacun crée son compte (octobre 2026) : plus de limite à un seul (\`auth.ts\` posait ce
  -- déclencheur sur la table de Better Auth).
  DROP TRIGGER IF EXISTS one_account;
  `,
  `
  -- Les pseudos qu'un compte a quittés (changé, ou compte supprimé) : jamais repris par un autre
  -- compte (\`auth.ts\`), sans quoi un lien partagé vers \`/@pseudo\` mènerait au Pokédex d'un autre.
  CREATE TABLE released_pseudos (username TEXT PRIMARY KEY, user_id TEXT NOT NULL) WITHOUT ROWID;
  `,
  `
  -- Quand chaque pseudo a été quitté : un compte ne garde que ses derniers (\`auth.ts\`).
  ALTER TABLE released_pseudos ADD COLUMN released_at TEXT NOT NULL DEFAULT '';
  `,
]

const userVersion = (db: Database) =>
  (db.query('PRAGMA user_version').get() as { user_version: number }).user_version

/** L'empreinte d'une étape : son texte, tel qu'appliqué. */
const fingerprint = (step: string) => new Bun.CryptoHasher('sha256').update(step).digest('hex')

/**
 * Applique les étapes du schéma pas encore passées, une transaction chacune, avec leur empreinte
 * (et celle des étapes appliquées avant les empreintes, au premier passage). À jour, aucun verrou :
 * l'autre processus peut tenir une longue écriture sans faire échouer ce démarrage ; les
 * empreintes gardées sont seulement relues. Une étape modifiée depuis son application, ou une base
 * plus avancée que `steps` : une erreur qui le dit, et rien n'est appliqué.
 */
export function migrate(db: Database, name: string, steps: string[]) {
  const reached = userVersion(db)
  if (reached > steps.length) {
    throw new Error(
      `${name} en est à l’étape ${reached} du schéma, ce code n’en connaît que ${steps.length} (un code plus ancien ?)`,
    )
  }
  const known = db.query(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_steps'",
  )
  if (known.get()) {
    const recorded = db.query('SELECT step, hash FROM schema_steps').all() as {
      step: number
      hash: string
    }[]
    for (const { step, hash } of recorded) {
      if (step <= reached && hash !== fingerprint(steps[step - 1]!)) {
        throw new Error(
          `${name} : l’étape ${step} du schéma a changé depuis son application. Remettez son texte d’origine et ajoutez une nouvelle étape (une étape enregistrée à moitié pendant que le serveur tournait ? reprenez la base)`,
        )
      }
    }
  }
  while (userVersion(db) < steps.length) {
    const applied = db.transaction(() => {
      const version = userVersion(db)
      const step = steps[version]
      if (step === undefined) return false
      db.run(step)
      db.run(`PRAGMA user_version = ${version + 1}`)
      db.run(
        'CREATE TABLE IF NOT EXISTS schema_steps (step INTEGER PRIMARY KEY, hash TEXT NOT NULL)',
      )
      const record = db.query('INSERT OR IGNORE INTO schema_steps (step, hash) VALUES (?, ?)')
      for (let index = 0; index <= version; index++) {
        record.run(index + 1, fingerprint(steps[index]!))
      }
      return true
    })
    // `immediate` : deux processus qui démarrent ensemble n'appliquent pas la même étape.
    if (!applied.immediate()) return
  }
}

/** La base des comptes et des collections synchronisées. */
export function openApp() {
  const name = 'app.db'
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(join(DATA_DIR, name), { create: true, strict: true })
  // Avant le passage en WAL : une copie de sauvegarde (`backups.ts`) ou un outil qui lit la base
  // la verrouille un instant, et ce passage échouerait tout de suite.
  db.run('PRAGMA busy_timeout = 5000')
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA synchronous = NORMAL')
  db.run('PRAGMA foreign_keys = ON')
  // Le journal WAL retombe à 64 Mo après une grosse écriture.
  db.run('PRAGMA journal_size_limit = 67108864')
  migrate(db, name, APP_STEPS)
  return db
}
