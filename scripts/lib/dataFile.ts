/** L'écriture des fichiers de `src/data` : un JSON lisible dans git, réécrit seulement s'il change. */

import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const DATA_DIR = join(import.meta.dirname, '..', '..', 'src', 'data')

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * JSON avec un élément par ligne pour les listes d'objets et les dictionnaires : le fichier reste
 * compact, et un élément qui change est une ligne qui change dans git.
 */
function serialize(file: Record<string, unknown>): string {
  const fields = Object.entries(file).map(([key, value]) => {
    const name = `  ${JSON.stringify(key)}: `
    if (Array.isArray(value) && value.some(isObject)) {
      return `${name}[\n${value.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`
    }
    if (isObject(value) && Object.keys(value).length > 0) {
      const entries = Object.entries(value).map(
        ([id, item]) => `    ${JSON.stringify(id)}: ${JSON.stringify(item)}`,
      )
      return `${name}{\n${entries.join(',\n')}\n  }`
    }
    return name + JSON.stringify(value)
  })
  return `{\n${fields.join(',\n')}\n}\n`
}

/**
 * Écrit un fichier de `src/data`. Quand seul `generatedAt` changerait, le fichier existant est
 * gardé tel quel : relancer un script sur les mêmes données ne modifie rien.
 */
export async function writeDataFile(
  name: string,
  build: (generatedAt: string) => Record<string, unknown>,
) {
  const path = join(DATA_DIR, name)
  const previous = await readFile(path, 'utf8').catch(() => null)
  const previousDate = previous && (JSON.parse(previous) as { generatedAt?: string }).generatedAt

  if (previous && previousDate && serialize(build(previousDate)) === previous) {
    console.log(`  ${relative(process.cwd(), path)} : inchangé`)
    return
  }
  const text = serialize(build(new Date().toISOString()))
  await writeFile(path, text, 'utf8')
  console.log(`  ${relative(process.cwd(), path)} : écrit (${Buffer.byteLength(text)} octets)`)
}
