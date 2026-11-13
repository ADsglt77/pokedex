/**
 * Migrer une collection vers le catalogue de TCGdex, une fois (novembre 2026) : le document
 * `collection` d'un compte tel que le garde le serveur (`schemaVersion`, `updatedAt`, `cards`,
 * `customCards`, `favorites`, `series`), lu dans un fichier JSON, et le catalogue de chaque langue
 * qu'il a, lu chez un site qui tourne (`/api/catalog/sets` puis chaque `/api/catalog/sets/<id>`,
 * sous `/api/catalog/fr/…` pour le français ; en développement `http://localhost:5173`, `bun dev`
 * et l'API des données lancés). Écrit le document migré, de même forme (`<fichier>-tcgdex.json`, ou
 * la sortie donnée), et son bilan (le même nom en `.txt`, aussi à l'écran). Ne lit et n'écrit que
 * des fichiers de ce poste : jamais une base, jamais le fichier lu. Les règles :
 * `src/lib/tcgdex-migration.ts`.
 *
 *   bun scripts/migrer-tcgdex.ts collection.json http://localhost:5173 [sortie.json]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cardLanguage } from '@/lib/collection'
import { migrateCollection, migrationReport, type Catalogs } from '@/lib/tcgdex-migration'
import { readCollection } from '@/lib/transfer'
import type { CardLanguage, CatalogSetFile, CatalogSetsFile } from '@/types'

const [input, site, output = `${input?.replace(/\.json$/i, '')}-tcgdex.json`] =
  process.argv.slice(2)
const reportFile = output.replace(/(\.json)?$/i, '.txt')
if (!input || !site || [output, reportFile].some((file) => resolve(file) === resolve(input))) {
  console.error('bun scripts/migrer-tcgdex.ts <collection.json> <adresse du site> [sortie.json]')
  process.exit(1)
}
const catalogUrl = `${site.replace(/\/+$/, '')}/api/catalog`

// Relue comme un fichier importé : un autre fichier est refusé.
const data = readCollection(JSON.parse(readFileSync(input, 'utf8')))
if (!data) {
  console.error(`${input} : ce n’est pas le document d’une collection.`)
  process.exit(1)
}

/** Une réponse du catalogue ; refusée pour trop de demandes (429), redemandée à l'heure dite. */
async function read<T>(url: string): Promise<T> {
  for (;;) {
    const response = await fetch(url)
    if (response.status === 429) {
      await Bun.sleep(Number(response.headers.get('retry-after') ?? 10) * 1000)
      continue
    }
    if (!response.ok) throw new Error(`${url} : ${response.status}`)
    return (await response.json()) as T
  }
}

/** Les séries du catalogue d'une langue et toutes leurs cartes, une série après l'autre. */
async function loadCatalog(lang: CardLanguage) {
  const root = lang === 'fr' ? `${catalogUrl}/fr` : catalogUrl
  const { sets } = await read<CatalogSetsFile>(`${root}/sets`)
  const loaded = []
  for (const [index, [id, name]] of sets.entries()) {
    process.stderr.write(`\r${lang} : série ${index + 1} sur ${sets.length}`)
    const { cards } = await read<CatalogSetFile>(`${root}/sets/${encodeURIComponent(id)}`)
    loaded.push({ id, name, cards })
  }
  process.stderr.write('\n')
  return loaded
}

const catalogs: Catalogs = {}
for (const lang of new Set(
  [...Object.values(data.customCards), ...data.series].map(cardLanguage),
)) {
  catalogs[lang] = await loadCatalog(lang)
}

const result = migrateCollection(data, catalogs)
const report = migrationReport(data, result)
writeFileSync(output, JSON.stringify(result.collection))
writeFileSync(reportFile, `${report}\n`)
console.log(`${report}\n\nÉcrits : ${output}, ${reportFile}`)
