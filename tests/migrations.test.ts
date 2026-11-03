/**
 * Le schéma : aucune reconstruction générée ne part telle quelle. Pour la plupart des changements
 * de colonne, Drizzle reconstruit la table (`PRAGMA foreign_keys=OFF`, `__new_user`, puis
 * `DROP TABLE user`) ; sur D1, ce PRAGMA ne fait rien, et la suppression emporte en cascade ce qui
 * en dépend : reconstruire `user` effacerait sessions, comptes et collections, et ses déclencheurs
 * des pseudos (`docs/deploiement.md`). Réécrite à la main, une telle migration porte
 * `-- reconstruction vérifiée`. Les migrations lues dans `worker/migrations`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'

const folder = new URL('../worker/migrations/', import.meta.url)

/** Les migrations qui coupent les clés étrangères sans être marquées vérifiées. */
const unchecked = (migrations: { name: string; sql: string }[]) =>
  migrations
    .filter(
      ({ sql }) =>
        /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sql) && !sql.includes('-- reconstruction vérifiée'),
    )
    .map(({ name }) => name)

test('aucune migration ne reconstruit une table sans être vérifiée', () => {
  // La forme qu'écrit Drizzle : refusée, sauf marquée.
  const generated = 'PRAGMA foreign_keys=OFF;--> statement-breakpoint\nDROP TABLE `user`;'
  expect(
    unchecked([
      { name: '0004_generee.sql', sql: generated },
      { name: '0005_verifiee.sql', sql: `-- reconstruction vérifiée\n${generated}` },
    ]),
  ).toEqual(['0004_generee.sql'])
  const migrations = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(new URL(name, folder), 'utf8') }))
  expect(unchecked(migrations)).toEqual([])
})
