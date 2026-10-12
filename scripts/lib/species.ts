/**
 * Le Pokémon d'une carte d'après son nom, quand la source ne le donne pas : le nom japonais d'une
 * carte TCGdex sans `dexId` (« ギャラドスex »), le nom anglais d'une carte TCGplayer (« Galarian
 * Sirfetch'd V - 106/100 »).
 */

import speciesFile from '@/data/species.json'
import type { SpeciesFile } from '@/types'

const SPECIES = (speciesFile as SpeciesFile).species

/** Sans accent, casse ni largeur, apostrophe droite : « Sirfetch’d » → « sirfetch'd ». */
const plain = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFKC')
    .replace(/’/g, "'")
    .toLowerCase()

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Les noms de chaque langue, les plus longs d'abord : « Porygon-Z » avant « Porygon ». En
 * anglais, un nom est un mot entier ; en japonais, sans espace, une suite de caractères.
 */
const patterns = (lang: 'en' | 'ja') =>
  SPECIES.flatMap(({ id, names }) => {
    const name = names[lang]
    return name ? [{ id, name: plain(name) }] : []
  })
    .sort((a, b) => b.name.length - a.name.length)
    .map(({ id, name }) => ({
      id,
      pattern: new RegExp(
        lang === 'en' ? `(?<![a-z0-9])${escapeRegExp(name)}(?![a-z0-9])` : escapeRegExp(name),
      ),
    }))

const PATTERNS = { en: patterns('en'), ja: patterns('ja') }

/**
 * Les Pokémon nommés, dans l'ordre du nom (« Pikachu & Zekrom GX » → [25, 644]). Un nom trouvé
 * est masqué : « Porygon » ne se retrouve pas dans « Porygon-Z », ni « ミュウ » dans « ミュウツー ».
 * Ce qui suit « - » (le numéro TCGplayer) et les parenthèses (variantes) ne comptent pas.
 */
export function speciesInName(name: string, lang: 'en' | 'ja'): number[] {
  let rest = plain(name.replace(/ - .*$/, '').replace(/\(.*?\)/g, ''))
  const found: { id: number; at: number }[] = []
  for (const { id, pattern } of PATTERNS[lang]) {
    const match = pattern.exec(rest)
    if (!match) continue
    found.push({ id, at: match.index })
    const end = match.index + match[0].length
    rest = rest.slice(0, match.index) + '#'.repeat(match[0].length) + rest.slice(end)
  }
  return found.sort((a, b) => a.at - b.at).map(({ id }) => id)
}
