/** Le Pokédex national : générations, noms des types, illustrations officielles (PokéAPI). */

import type { ArtworkPath, GenerationId, PokemonTypeId, SpritePath, TotalSpecies } from '@/types'

export interface Generation {
  id: GenerationId
  numeral: string
  region: string
}

/**
 * Chaque génération du contrat (`GenerationId`), son chiffre romain et sa région : une génération
 * ajoutée au contrat sans sa ligne ici, et `tsc` échoue (la grille du Pokédex, qui les range par
 * génération, tomberait).
 */
const GENERATION_NAMES = {
  1: { numeral: 'I', region: 'Kanto' },
  2: { numeral: 'II', region: 'Johto' },
  3: { numeral: 'III', region: 'Hoenn' },
  4: { numeral: 'IV', region: 'Sinnoh' },
  5: { numeral: 'V', region: 'Unys' },
  6: { numeral: 'VI', region: 'Kalos' },
  7: { numeral: 'VII', region: 'Alola' },
  8: { numeral: 'VIII', region: 'Galar' },
  9: { numeral: 'IX', region: 'Paldea' },
} satisfies Record<GenerationId, Omit<Generation, 'id'>>

/** Les générations, dans l'ordre (celui des clés numériques d'un objet). */
export const GENERATIONS: readonly Generation[] = Object.entries(GENERATION_NAMES).map(
  ([id, names]) => ({ id: Number(id) as GenerationId, ...names }),
)

/**
 * Le nombre d'espèces du Pokédex national : celui du contrat (`TotalSpecies`), le même que l'API
 * des données.
 */
export const TOTAL_SPECIES: TotalSpecies = 1025

export function generationById(id: number): Generation | undefined {
  return GENERATIONS.find((generation) => generation.id === id)
}

/** « I – Kanto » */
export const generationLabel = (generation: Generation) =>
  `${generation.numeral} – ${generation.region}`

/** Les options d'un choix de génération, « toutes » (`''`) d'abord. */
export const GENERATION_OPTIONS = [
  { value: '', label: 'Toutes les générations' },
  ...GENERATIONS.map((generation) => ({
    value: String(generation.id),
    label: generationLabel(generation),
  })),
]

/** Le nom français de chaque type ; sa couleur est un jeton de `styles/theme.css` (`--type-fire`…). */
export const POKEMON_TYPES: Record<PokemonTypeId, string> = {
  normal: 'Normal',
  fire: 'Feu',
  water: 'Eau',
  electric: 'Électrik',
  grass: 'Plante',
  ice: 'Glace',
  fighting: 'Combat',
  poison: 'Poison',
  ground: 'Sol',
  flying: 'Vol',
  psychic: 'Psy',
  bug: 'Insecte',
  rock: 'Roche',
  ghost: 'Spectre',
  dragon: 'Dragon',
  dark: 'Ténèbres',
  steel: 'Acier',
  fairy: 'Fée',
}

// Les images des Pokémon, de PokéAPI, copiées par l'API des données (leurs gabarits : le contrat,
// les mêmes que `spriteUrl` et `artworkUrl` de `../pokedex-data/src/lib/image-paths.ts`).

/** Sprite 96×96, sur la carte de substitution d'une carte sans image ou d'un Pokémon sans carte. */
export const spriteUrl = (speciesId: number): SpritePath => `/images/species/${speciesId}.png`

/**
 * Illustration officielle 475×475 : sur la fiche d'un Pokémon sans carte, et sur la tuile d'un
 * Pokédex sans carte à montrer (page Collections).
 */
export const artworkUrl = (speciesId: number): ArtworkPath =>
  `/images/species/artwork/${speciesId}.png`
