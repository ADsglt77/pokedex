/**
 * Les 1 025 espèces, données par le serveur (`/api/species`, tâche `species` d'après PokéAPI) avant
 * le premier affichage (`main.tsx`), et leurs détails à la demande. Les cartes, elles, sont celles
 * que l'utilisateur ajoute (`customCards`).
 */

import { derived, getJson } from '@/lib/api'
import type {
  CollectionData,
  PokemonCard,
  PokemonSpecies,
  PokemonSpeciesDetails,
  SpeciesDetailsFile,
  SpeciesFile,
} from '@/types'

/** Les espèces, dans l'ordre du Pokédex (vide tant qu'elles ne sont pas données). */
export let SPECIES: readonly PokemonSpecies[] = []

let speciesById = new Map<number, PokemonSpecies>()

/** Demande les espèces au serveur et les donne à l'app ; `false` s'il ne répond pas. */
export async function loadSpecies() {
  const file = await getJson<SpeciesFile>('/api/species')
  if (file) {
    SPECIES = file.species
    speciesById = new Map(file.species.map((species) => [species.id, species]))
  }
  return file !== null
}

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

/**
 * Description, taille, poids… (`/api/species/details`), chargés à la première fiche ouverte ; vide
 * si le serveur ne répond pas (redemandé une minute après au plus tôt, `getJson`). Toujours la
 * même promesse, lue par `use()`.
 */
export const loadSpeciesDetails = derived<SpeciesDetailsFile, Map<number, PokemonSpeciesDetails>>(
  '/api/species/details',
  (file) => new Map((file?.details ?? []).map((entry) => [entry.id, entry])),
)
