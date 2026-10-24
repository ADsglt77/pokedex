/** Le Pokédex national : générations, noms des types, illustrations officielles (PokéAPI). */

import type { GenerationId, PokemonTypeId } from '@/types'

export interface Generation {
  id: GenerationId
  numeral: string
  region: string
  first: number
  last: number
}

export const GENERATIONS: readonly Generation[] = [
  { id: 1, numeral: 'I', region: 'Kanto', first: 1, last: 151 },
  { id: 2, numeral: 'II', region: 'Johto', first: 152, last: 251 },
  { id: 3, numeral: 'III', region: 'Hoenn', first: 252, last: 386 },
  { id: 4, numeral: 'IV', region: 'Sinnoh', first: 387, last: 493 },
  { id: 5, numeral: 'V', region: 'Unys', first: 494, last: 649 },
  { id: 6, numeral: 'VI', region: 'Kalos', first: 650, last: 721 },
  { id: 7, numeral: 'VII', region: 'Alola', first: 722, last: 809 },
  { id: 8, numeral: 'VIII', region: 'Galar', first: 810, last: 905 },
  { id: 9, numeral: 'IX', region: 'Paldea', first: 906, last: 1025 },
]

export const TOTAL_SPECIES = GENERATIONS.at(-1)!.last

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

/** Illustration officielle 475×475, sur la fiche d'un Pokémon sans carte. */
export const artworkUrl = (speciesId: number) => `/images/species/artwork/${speciesId}.png`
