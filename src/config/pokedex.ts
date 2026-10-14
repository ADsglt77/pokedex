/** Le Pokédex national : générations, couleurs des types, illustrations officielles (PokéAPI). */

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

export const POKEMON_TYPES: Record<PokemonTypeId, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#C9C7B6' },
  fire: { label: 'Feu', color: '#F0A987' },
  water: { label: 'Eau', color: '#9CC3EE' },
  electric: { label: 'Électrik', color: '#F2DC8A' },
  grass: { label: 'Plante', color: '#A8D9A0' },
  ice: { label: 'Glace', color: '#B5E3E6' },
  fighting: { label: 'Combat', color: '#DDA193' },
  poison: { label: 'Poison', color: '#C9A6DD' },
  ground: { label: 'Sol', color: '#DEC59A' },
  flying: { label: 'Vol', color: '#BFC8F2' },
  psychic: { label: 'Psy', color: '#F2A9C0' },
  bug: { label: 'Insecte', color: '#C8D989' },
  rock: { label: 'Roche', color: '#CFC198' },
  ghost: { label: 'Spectre', color: '#B3A9D6' },
  dragon: { label: 'Dragon', color: '#A9A6EE' },
  dark: { label: 'Ténèbres', color: '#A99F99' },
  steel: { label: 'Acier', color: '#BFCBD4' },
  fairy: { label: 'Fée', color: '#F1BEDD' },
}

// Les images des Pokémon, de PokéAPI, copiées par le serveur (`server/images.ts`).

/** Sprite 96×96, sur la carte de substitution d'une carte sans image ou d'un Pokémon sans carte. */
export const spriteUrl = (speciesId: number) => `/images/species/${speciesId}.png`

/** Illustration officielle 475×475, sur la fiche d'un Pokémon sans carte. */
export const artworkUrl = (speciesId: number) => `/images/species/artwork/${speciesId}.png`
