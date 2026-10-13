/**
 * Construit le catalogue des espèces à partir de PokéAPI : `src/data/species.json` et
 * `src/data/species-details.json`. L'app n'appelle jamais PokéAPI elle-même.
 *
 *   bun run data [--refresh]
 */

import { GENERATIONS, TOTAL_SPECIES } from '@/config/pokedex'
import type { PokemonSpecies, PokemonSpeciesDetails, PokemonTypeId } from '@/types'
import { writeDataFile } from './lib/dataFile'
import { fetchJson, mapPool } from './lib/net'

const API = 'https://pokeapi.co/api/v2'

interface Localized {
  language: { name: string }
}

interface RawSpecies {
  id: number
  names: (Localized & { name: string })[]
  genera: (Localized & { genus: string })[]
  flavor_text_entries: (Localized & { flavor_text: string })[]
  is_baby: boolean
  is_legendary: boolean
  is_mythical: boolean
}

interface RawPokemon {
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
  const generation = GENERATIONS.find((row) => species.id >= row.first && species.id <= row.last)!
  const genus = inLanguage(species.genera, 'fr')
    .map((entry) => entry.genus.trim())
    .find(Boolean)

  const entry: PokemonSpecies = {
    id: species.id,
    names: {
      fr: firstName(species, 'fr')!,
      en: firstName(species, 'en')!,
      ja: firstName(species, 'ja-hrkt') ?? firstName(species, 'ja'),
    },
    types: [...pokemon.types]
      .sort((a, b) => a.slot - b.slot)
      .map(({ type }) => type.name as PokemonTypeId),
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
  generatedAt,
  species: catalogue.map((row) => row.entry),
}))
await writeDataFile('species-details.json', (generatedAt) => ({
  generatedAt,
  details: catalogue.map((row) => row.details),
}))
