/**
 * Le schéma de la base du site (D1, `DB`) : les comptes, tels que les attend Better Auth (`user`,
 * `session`, `account`, `verification`, et ses compteurs de tentatives `rateLimit`), les pseudos
 * quittés (`releasedPseudos`, `auth.ts`) et la collection de chaque compte (`collections`). Les
 * colonnes de Better Auth portent le nom de leur clé, celles de l'app sont en minuscules
 * (`user_id`). Après une modification : `bun run db:generate` en écrit la migration
 * (`migrations/`), que `bun dev` applique à la base locale. Les déclencheurs des pseudos, que
 * Drizzle n'écrit pas, ont leur migration écrite à la main.
 */

import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Une date, en millisecondes (ce qu'écrit Better Auth). */
const date = () => integer({ mode: 'timestamp_ms' })

/** Maintenant, en millisecondes, par la base. */
const NOW = sql`(cast(unixepoch('subsecond') * 1000 as integer))`

export const user = sqliteTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: 'boolean' }).notNull().default(false),
  image: text(),
  createdAt: date().notNull().default(NOW),
  updatedAt: date().notNull().default(NOW),
  username: text().unique(),
})

export const session = sqliteTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: date().notNull(),
    token: text().notNull().unique(),
    createdAt: date().notNull().default(NOW),
    updatedAt: date().notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: date(),
    refreshTokenExpiresAt: date(),
    scope: text(),
    password: text(),
    createdAt: date().notNull().default(NOW),
    updatedAt: date().notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: date().notNull(),
    createdAt: date().notNull().default(NOW),
    updatedAt: date().notNull().default(NOW),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

/**
 * Les tentatives de chaque visiteur (`rateLimit` de `auth.ts`), dans la base : un Worker tourne en
 * plusieurs exemplaires, qui ne partagent pas leur mémoire.
 */
export const rateLimit = sqliteTable('rateLimit', {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: integer().notNull(),
})

/**
 * Les pseudos qu'un compte a quittés (changé, ou compte supprimé) : jamais repris par un autre
 * compte, sans quoi un lien partagé vers `/pseudo` mènerait au Pokédex d'un autre. Un compte n'en
 * garde que ses derniers (`released_at`). Tenus par les déclencheurs de leur migration.
 */
export const releasedPseudos = sqliteTable('released_pseudos', {
  username: text().primaryKey(),
  userId: text('user_id').notNull(),
  releasedAt: text('released_at').notNull(),
})

/**
 * La collection et les achats de chaque compte, tels que les enregistre le navigateur (JSON), partis
 * avec le compte. `version` augmente à chaque enregistrement : un appareil qui envoie une version
 * dépassée est refusé (il n'écrase pas ce qu'un autre a envoyé entre-temps, `collection.ts`).
 */
export const collections = sqliteTable('collections', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  version: integer().notNull(),
  collection: text().notNull(),
  shopping: text().notNull(),
  updatedAt: text('updated_at').notNull(),
})
