/** La base du site (D1, `DB`), par Drizzle, avec son schéma (`schema.ts`). */

import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export const db = drizzle(env.DB, { schema })
