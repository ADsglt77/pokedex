/**
 * Construit le catalogue des espèces à partir de PokéAPI : `src/data/species.json` et
 * `src/data/species-details.json`. L'app n'appelle jamais PokéAPI elle-même.
 *
 *   bun run data:species [--refresh]
 */

import { GENERATIONS, POKEMON_TYPES, TOTAL_SPECIES } from '@/config/pokedex'
import type { PokemonSpecies, PokemonSpeciesDetails, PokemonTypeId } from '@/types'
import { writeDataFile } from './lib/dataFile'
import { fetchJson, mapPool } from './lib/net'

const API = 'https://pokeapi.co/api/v2'

interface Localized {
  language: { name: string }
}

interface RawSpecies {
  id: number
  name: string
  names: (Localized & { name: string })[]
  genera: (Localized & { genus: string })[]
  flavor_text_entries: (Localized & { flavor_text: string })[]
  generation: { name: string }
  is_baby: boolean
  is_legendary: boolean
  is_mythical: boolean
}

interface RawPokemon {
  id: number
  is_default: boolean
  species: { name: string }
  types: { slot: number; type: { name: string } }[]
  height: number | null
  weight: number | null
}

// La langue des kana est `ja-hrkt` aujourd'hui, `ja-Hrkt` dans les anciennes données.
const inLanguage = <T extends Localized>(entries: T[], language: string) =>
  entries.filter((entry) => entry.language.name.toLowerCase() === language)

const firstName = (species: RawSpecies, language: string) =>
  inLanguage(species.names, language)
    .map((entry) => entry.name.trim())
    .find(Boolean) ?? null

/**
 * Un texte de Pokédex mis en page pour l'écran du jeu, sur une ligne : un tiret conditionnel
 * avant un saut de ligne marque un mot coupé, un tiret visible est gardé (« demi-journée »).
 */
const cleanFlavorText = (text: string) =>
  text
    .replace(/\xad[\r\n\f]+/g, '')
    .replace(/([\p{L}\p{N}])-[\r\n\f]+(?=[\p{L}\p{N}])/gu, '$1-')
    .replace(/[ \t\r\n\v\f\xad]+/g, ' ')
    .trim()

/** Dixièmes d'unité → unités. Aucun Pokémon ne mesure 0 : cela veut dire « inconnu ». */
const fromTenths = (value: number | null) => (value && value > 0 ? value / 10 : null)

function normalize(species: RawSpecies, pokemon: RawPokemon) {
  const error = (message: string) =>
    new Error(`Espèce n° ${species.id} (${species.name}) : ${message}`)

  // Les deux documents sont demandés par numéro : lire une forme alternative ou une autre
  // espèce décrirait le mauvais Pokémon.
  if (pokemon.id !== species.id || pokemon.species.name !== species.name || !pokemon.is_default) {
    throw error(`le Pokémon n° ${pokemon.id} n'est pas sa forme par défaut`)
  }

  const generation = GENERATIONS.find(
    (candidate) => species.id >= candidate.first && species.id <= candidate.last,
  )
  if (generation?.numeral !== species.generation.name.replace('generation-', '').toUpperCase()) {
    throw error(`génération « ${species.generation.name} » incohérente avec son numéro`)
  }

  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot).map(({ type }) => type.name)
  if (!types.every((type): type is PokemonTypeId => Object.hasOwn(POKEMON_TYPES, type))) {
    throw error(`type inconnu parmi ${types.join(', ')}`)
  }

  const fr = firstName(species, 'fr')
  const en = firstName(species, 'en')
  if (!fr || !en) throw error('nom français ou anglais manquant')

  const genus = inLanguage(species.genera, 'fr')
    .map((entry) => entry.genus.trim())
    .find(Boolean)

  const entry: PokemonSpecies = {
    id: species.id,
    slug: species.name,
    names: { fr, en, ja: firstName(species, 'ja-hrkt') ?? firstName(species, 'ja') },
    types,
    generation: generation.id,
  }
  const details: PokemonSpeciesDetails = {
    id: species.id,
    // La génération IX omet le « Pokémon » de la catégorie.
    genus: genus ? (genus.startsWith('Pokémon') ? genus : `Pokémon ${genus}`) : null,
    // L'entrée des jeux les plus récents.
    description:
      inLanguage(species.flavor_text_entries, 'fr')
        .map((flavor) => cleanFlavorText(flavor.flavor_text))
        .findLast(Boolean) ?? null,
    heightM: fromTenths(pokemon.height),
    weightKg: fromTenths(pokemon.weight),
    isBaby: species.is_baby,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
  }
  return { entry, details }
}

const ids = Array.from({ length: TOTAL_SPECIES }, (_, index) => index + 1)
console.log(`Lecture des ${TOTAL_SPECIES} espèces sur PokéAPI…`)
const catalogue = await mapPool(ids, 8, async (id) =>
  normalize(
    await fetchJson<RawSpecies>(`${API}/pokemon-species/${id}`, 'pokeapi'),
    await fetchJson<RawPokemon>(`${API}/pokemon/${id}`, 'pokeapi'),
  ),
)

await writeDataFile('species.json', (generatedAt) => ({
  schemaVersion: 1,
  generatedAt,
  source: API,
  species: catalogue.map((row) => row.entry),
}))
await writeDataFile('species-details.json', (generatedAt) => ({
  schemaVersion: 1,
  generatedAt,
  source: API,
  details: catalogue.map((row) => row.details),
}))
