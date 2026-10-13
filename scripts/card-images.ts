/**
 * Construit la table des images de cartes à partir de TCGdex : `src/data/card-images.json`. Pour
 * chaque extension, le code que Cardmarket écrit dans le nom de ses cartes (« Bulbizarre (sv2a
 * 166) ») et le dossier où TCGdex range ses images. Une japonaise a pour code son id chez TCGdex
 * (SV2a), une anglaise son abréviation officielle (MEW). TCGdex publie aussi des images qu'il ne
 * déclare pas, souvent pour une partie des cartes d'une extension : toutes les extensions sont
 * donc gardées, et l'app vérifie que l'image d'une carte existe avant de l'enregistrer. Elle
 * n'appelle jamais TCGdex : elle charge seulement l'image.
 *
 *   bun run data:images [--refresh]   (--refresh : pour voir les nouvelles extensions)
 */

import { writeDataFile } from './lib/dataFile'
import { fetchJson, mapPool } from './lib/net'

const API = 'https://api.tcgdex.net/v2'

interface RawSet {
  id: string
  serie: { id: string }
  abbreviation?: { official?: string }
  cards: { localId: string }[]
}

/** Le dossier des images d'une extension, et la longueur de ses numéros (0 : pas de zéro devant). */
type Folder = [path: string, digits: number]

async function foldersOf(language: 'ja' | 'en') {
  const sets = await fetchJson<{ id: string }[]>(`${API}/${language}/sets`, 'tcgdex')
  const details = await mapPool(sets, 4, ({ id }) =>
    fetchJson<RawSet>(`${API}/${language}/sets/${encodeURIComponent(id)}`, 'tcgdex'),
  )
  const folders: [code: string, folder: Folder][] = []
  for (const set of details) {
    const code = language === 'ja' ? set.id : set.abbreviation?.official
    if (!code) continue
    // Les images d'une carte : https://assets.tcgdex.net/ja/SV/SV2a/001/low.webp
    const padded = set.cards.find(({ localId }) => /^0\d+$/.test(localId))
    folders.push([
      code.toLowerCase(),
      [`${language}/${set.serie.id}/${set.id}`, padded?.localId.length ?? 0],
    ])
  }
  return folders
}

console.log('Extensions de TCGdex…')
const japanese = await foldersOf('ja')
const english = await foldersOf('en')

// Un code porté par deux extensions ne dit pas laquelle : il est écarté plutôt que deviné.
const counts = new Map<string, number>()
for (const [code] of [...japanese, ...english]) counts.set(code, (counts.get(code) ?? 0) + 1)
const ambiguous = [...counts].filter(([, count]) => count > 1).map(([code]) => code)
if (ambiguous.length) console.log(`  codes ambigus, écartés : ${ambiguous.join(', ')}`)

const folders = Object.fromEntries(
  [...japanese, ...english]
    .filter(([code]) => !ambiguous.includes(code))
    .sort(([a], [b]) => a.localeCompare(b)),
)
console.log(`  ${japanese.length} extensions japonaises, ${english.length} anglaises`)

await writeDataFile('card-images.json', (generatedAt) => ({
  source: 'TCGdex (api.tcgdex.net, assets.tcgdex.net)',
  generatedAt,
  folders,
}))
