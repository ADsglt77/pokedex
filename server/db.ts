/**
 * Les bases SQLite du serveur, dans `DATA_DIR` (`.data/` en local, le volume `db` sur le VPS) :
 * - `data.db` : les données de référence (catalogue, prix, historique…), écrites par les tâches
 *   d'ingestion (`ingest.ts`) seulement ; l'API la lit ;
 * - `app.db` : le compte (Better Auth, `auth.ts`) et la collection synchronisée, écrite par l'API
 *   seulement. Petite mais irremplaçable : à part, elle ne risque rien quand on refait l'autre.
 * Le schéma évolue par étapes (`PRAGMA user_version`) : une étape ajoutée ne modifie jamais les
 * précédentes, déjà appliquées.
 */

import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '..', '.data')

const DATA_STEPS = [
  `
  -- Ce qu'on a lu de chaque source à son dernier passage : \`stamp\`, sa date de mise à jour (pour
  -- ne pas la retélécharger si elle n'a pas changé), et \`date\`, le jour de ses données.
  CREATE TABLE sources (name TEXT PRIMARY KEY, stamp TEXT NOT NULL, date TEXT NOT NULL);

  -- Le journal des tâches : \`ok\` et \`finished_at\` restent nuls tant qu'elle tourne.
  CREATE TABLE runs (
    id INTEGER PRIMARY KEY,
    job TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    ok INTEGER,
    message TEXT
  );
  CREATE INDEX runs_by_job ON runs (job, id);

  -- Le prix du jour de chaque carte Cardmarket (tendance, sinon moyenne 30 jours), par id produit.
  CREATE TABLE cardmarket_prices (
    id INTEGER PRIMARY KEY,
    price REAL NOT NULL,
    low REAL,
    avg30 REAL
  );

  -- Le nom de chaque produit Cardmarket (liste publique des produits).
  CREATE TABLE cardmarket_products (id INTEGER PRIMARY KEY, name TEXT NOT NULL);

  -- L'historique : un prix par jour (\`null\` sans prix), un tableau JSON par carte et par année,
  -- à partir du jour de l'année \`first\` (0 : 1er janvier), celui de son premier prix. Une ligne
  -- par année : la mise à jour du jour ne réécrit jamais des années entières.
  CREATE TABLE cardmarket_history (
    id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    first INTEGER NOT NULL,
    prices TEXT NOT NULL,
    PRIMARY KEY (id, year)
  ) WITHOUT ROWID;

  -- Le prix du jour chez TCGplayer, converti en euros, des cartes du catalogue sans prix
  -- Cardmarket, par code (\`codeKey\` : « E1 97 »).
  CREATE TABLE tcgplayer_prices (code TEXT PRIMARY KEY, price REAL NOT NULL, low REAL) WITHOUT ROWID;

  -- Dollars pour un euro, au cours de référence de la Banque centrale européenne.
  CREATE TABLE rates (date TEXT PRIMARY KEY, usd_per_eur REAL NOT NULL);

  -- Les réponses volumineuses de l'API, calculées en fin de tâche et compressées (gzip).
  CREATE TABLE snapshots (name TEXT PRIMARY KEY, etag TEXT NOT NULL, body BLOB NOT NULL);
  `,
  `
  -- Le catalogue des cartes Pokémon japonaises (tâche \`catalog\`, d'après TCGdex) : les extensions
  -- de ses cartes (\`released\` : '' si TCGdex ne la donne pas ; \`tcgplayer_groups\` : JSON, les
  -- groupes TCGplayer de leurs cartes, où lire le prix de celles sans prix Cardmarket)…
  CREATE TABLE sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    released TEXT NOT NULL,
    tcgplayer_groups TEXT NOT NULL
  );

  -- … ses cartes (\`key\` : « SV2a 166 », l'extension et le numéro chez TCGdex ; \`cardmarket\` : 0
  -- si inconnu ou douteux ; \`tcgplayer\` : le produit TCGplayer, 0 sans ; \`seen\` : le dernier
  -- passage qui l'a vue, une carte que TCGdex ne donne plus est retirée)…
  CREATE TABLE cards (
    key TEXT PRIMARY KEY,
    set_id TEXT NOT NULL,
    number TEXT NOT NULL,
    suffix TEXT NOT NULL,
    cardmarket INTEGER NOT NULL,
    tcgplayer INTEGER NOT NULL,
    seen TEXT NOT NULL
  );

  -- … et leurs Pokémon, dans l'ordre (plusieurs pour une carte TAG TEAM).
  CREATE TABLE card_species (
    card TEXT NOT NULL REFERENCES cards (key) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    dex_id INTEGER NOT NULL,
    PRIMARY KEY (card, rank)
  ) WITHOUT ROWID;
  `,
  `
  -- L'image de chaque carte, copiée chez nous par la tâche \`images\` : \`pokecardex\`, \`tcgplayer\`
  -- (celle de son produit, quand Pokécardex n'a pas la sienne) ou \`none\` ; nulle tant qu'elle n'a
  -- pas été cherchée. \`image_checked\` : le jour où elle l'a été (sans scan Pokécardex, elle est
  -- recherchée chaque semaine).
  ALTER TABLE cards ADD COLUMN image TEXT;
  ALTER TABLE cards ADD COLUMN image_checked TEXT;
  `,
  `
  -- D'où vient chaque carte du catalogue : \`tcgdex\`, ou \`tcgplayer\` pour celles que TCGdex n'a
  -- pas (decks, promos…).
  ALTER TABLE cards ADD COLUMN source TEXT NOT NULL DEFAULT 'tcgdex';
  `,
  `
  -- Les espèces (tâche \`species\`, d'après PokéAPI) : \`data\`, ce que l'app affiche partout (noms,
  -- types, génération) ; \`details\`, ce que montre la fiche (catégorie, description, taille…).
  CREATE TABLE species (id INTEGER PRIMARY KEY, data TEXT NOT NULL, details TEXT NOT NULL);
  `,
  `
  -- Le catalogue vient de Pokécardex (octobre 2026) : TCGdex et TCGplayer sont retirés, avec la BCE
  -- qui convertissait les prix de TCGplayer. La tâche \`catalog\` le refait entièrement.
  DROP TABLE card_species;
  DROP TABLE cards;
  DROP TABLE sets;
  DROP TABLE tcgplayer_prices;
  DROP TABLE rates;
  DELETE FROM sources WHERE name IN ('catalog', 'tcgplayer');
  DELETE FROM snapshots WHERE name = 'catalog';

  -- Les séries japonaises de Pokécardex : leur code (« SV2A »), leur nom, leur sortie au Japon
  -- (YYYY-MM-DD, '' si inconnue), et la dernière lecture de leur page.
  CREATE TABLE sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    released TEXT NOT NULL,
    read_at TEXT NOT NULL
  );

  -- Leurs cartes Pokémon, par leur id chez Pokécardex : le numéro imprimé (« 001 » ; sans numéro,
  -- leur rang), leur rang dans la série (\`sort\`, aussi le numéro de leur image), leur nom
  -- français, leur id Cardmarket (0 : aucun), la lecture qui les a vues (\`seen\` : une carte
  -- qu'une lecture de sa série ne voit plus est retirée). \`image\` : \`pokecardex\` ou \`none\`, nulle
  -- tant qu'elle n'a pas été cherchée par la tâche \`images\` ; \`image_checked\` : quand.
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    set_id TEXT NOT NULL REFERENCES sets (id),
    number TEXT NOT NULL,
    sort INTEGER NOT NULL,
    name TEXT NOT NULL,
    cardmarket INTEGER NOT NULL,
    seen TEXT NOT NULL,
    image TEXT,
    image_checked TEXT
  );
  CREATE INDEX cards_by_set ON cards (set_id);

  -- Leurs Pokémon, dans l'ordre (plusieurs pour une carte TAG TEAM).
  CREATE TABLE card_species (
    card INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    dex_id INTEGER NOT NULL,
    PRIMARY KEY (card, rank)
  ) WITHOUT ROWID;
  `,
]

/**
 * Les tables de l'app ; celles du compte (`user`, `session`, `account`, `verification`), Better
 * Auth les crée lui-même (`auth.ts`).
 */
const APP_STEPS = [
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
]

/** Applique les étapes du schéma pas encore passées, une transaction chacune. */
function migrate(db: Database, steps: string[]) {
  for (;;) {
    const applied = db.transaction(() => {
      const { user_version: version } = db.query('PRAGMA user_version').get() as {
        user_version: number
      }
      const step = steps[version]
      if (step === undefined) return false
      db.run(step)
      db.run(`PRAGMA user_version = ${version + 1}`)
      return true
    })
    // `immediate` : deux processus qui démarrent ensemble n'appliquent pas la même étape.
    if (!applied.immediate()) return
  }
}

/** Ce qu'on a lu d'une source à son dernier passage (table `sources`). */
interface Source {
  /** Sa date de mise à jour, telle qu'elle la donne : inchangée, rien n'est retéléchargé. */
  stamp: string
  /** Le jour de ses données (YYYY-MM-DD). */
  date: string
}

export const readSource = (db: Database, name: string) =>
  db.query('SELECT stamp, date FROM sources WHERE name = ?').get(name) as Source | null

export function writeSource(db: Database, name: string, { stamp, date }: Source) {
  db.query(
    `INSERT INTO sources (name, stamp, date) VALUES (?, ?, ?)
     ON CONFLICT (name) DO UPDATE SET stamp = excluded.stamp, date = excluded.date`,
  ).run(name, stamp, date)
}

/**
 * La base des données de référence. `readonly` (l'API) : le schéma est mis à jour, puis la
 * connexion refuse toute écriture.
 */
export function openData({ readonly = false } = {}) {
  const db = open('data.db', DATA_STEPS)
  if (readonly) db.run('PRAGMA query_only = ON')
  return db
}

/** La base du compte et de la collection synchronisée (l'API seulement). */
export const openApp = () => open('app.db', APP_STEPS)

function open(name: string, steps: string[]) {
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(join(DATA_DIR, name), { create: true, strict: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA synchronous = NORMAL')
  db.run('PRAGMA busy_timeout = 5000')
  db.run('PRAGMA foreign_keys = ON')
  migrate(db, steps)
  return db
}
