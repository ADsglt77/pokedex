/** Le Pokédex national : générations, noms des types, illustrations officielles (PokéAPI). */

import type { GenerationId, PokemonTypeId } from '@/types'

export interface Generation {
  id: GenerationId
  numeral: string
  region: string
}

export const GENERATIONS: readonly Generation[] = [
  { id: 1, numeral: 'I', region: 'Kanto' },
  { id: 2, numeral: 'II', region: 'Johto' },
  { id: 3, numeral: 'III', region: 'Hoenn' },
  { id: 4, numeral: 'IV', region: 'Sinnoh' },
  { id: 5, numeral: 'V', region: 'Unys' },
  { id: 6, numeral: 'VI', region: 'Kalos' },
  { id: 7, numeral: 'VII', region: 'Alola' },
  { id: 8, numeral: 'VIII', region: 'Galar' },
  { id: 9, numeral: 'IX', region: 'Paldea' },
]

/** Le nombre d'espèces du Pokédex national (les neuf générations). */
export const TOTAL_SPECIES = 1025

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

// Les images des Pokémon, de PokéAPI, copiées par l'API des données.

/** Sprite 96×96, sur la carte de substitution d'une carte sans image ou d'un Pokémon sans carte. */
export const spriteUrl = (speciesId: number) => `/images/species/${speciesId}.png`

/**
 * Illustration officielle 475×475 : sur la fiche d'un Pokémon sans carte, et sur la tuile d'un
 * Pokédex sans carte à montrer (page Collections).
 */
export const artworkUrl = (speciesId: number) => `/images/species/artwork/${speciesId}.png`
