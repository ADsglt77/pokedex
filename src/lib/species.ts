/**
 * Les données embarquées (`src/data`, écrites par `bun run data`) : les 1 025 espèces, et leurs
 * détails à la demande. Les cartes, elles, sont celles que l'utilisateur ajoute (`customCards`).
 */

import speciesJson from '@/data/species.json'
import { settled } from '@/lib/settled'
import type {
  CollectionData,
  PokemonCard,
  PokemonSpecies,
  PokemonSpeciesDetails,
  SpeciesDetailsFile,
  SpeciesFile,
} from '@/types'

export const SPECIES = (speciesJson as SpeciesFile).species

const speciesById = new Map(SPECIES.map((species) => [species.id, species]))

export const getSpecies = (id: number): PokemonSpecies | null => speciesById.get(id) ?? null

/** Une carte ajoutée par l'utilisateur ; `null` si elle n'existe pas (ou plus). */
export const findCard = (id: string, collection: CollectionData): PokemonCard | null =>
  collection.customCards[id] ?? null

/** Les Pokémon d'une carte : plusieurs pour une carte TAG TEAM d'une ancienne version. */
export const speciesOf = (card: PokemonCard): PokemonSpecies[] =>
  card.dexIds.flatMap((id) => getSpecies(id) ?? [])

/** « Pikachu & Zekrom » ; la référence pour une carte sans Pokémon connu. */
export const cardTitle = (card: PokemonCard) =>
  speciesOf(card)
    .map((species) => species.names.fr)
    .join(' & ') || card.reference

let speciesDetails: Promise<Map<number, PokemonSpeciesDetails>> | null = null

/**
 * Description, taille, poids… : un fichier à part, chargé à la première fiche ouverte. Toujours
 * la même promesse, lue par `use()`.
 */
export function loadSpeciesDetails() {
  speciesDetails ??= settled(
    import('@/data/species-details.json').then(
      ({ default: file }) =>
        new Map((file as SpeciesDetailsFile).details.map((details) => [details.id, details])),
    ),
  )
  return speciesDetails
}
