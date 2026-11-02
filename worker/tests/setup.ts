/**
 * Avant chaque fichier de test du Worker (`vitest.config.ts`) : sa base D1, migrée comme celle du
 * site (`worker/migrations`, lues par la configuration : `MIGRATIONS`, `env.d.ts`), et le journal
 * du Worker muet (`console.log`, une ligne par évènement) : un test qui lit ses lignes reprend cet
 * espion avec `vi.spyOn(console, 'log')`, qui le rend tel quel (lu par `console.log`, le moteur de
 * Cloudflare en rend une copie liée, sans `mock`).
 */

import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { vi } from 'vitest'

vi.spyOn(console, 'log').mockImplementation(() => {})

await applyD1Migrations(env.DB, env.MIGRATIONS)
