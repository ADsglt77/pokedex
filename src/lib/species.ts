/**
 * Les 1 025 espèces, données par l'API des données (`/api/species`, d'après PokéAPI) avant
 * le premier affichage (`main.tsx`), et leurs détails à la demande. Les cartes, elles, sont celles
 * que l'utilisateur ajoute (`customCards`).
 */

import { derived, getJson } from '@/lib/api'
import { formatList } from '@/lib/format'
import type {
  PokemonCard,
  PokemonSpecies,
  PokemonSpeciesDetails,
  SpeciesDetailsFile,
  SpeciesFile,
} from '@/types'

/** Les espèces, dans l'ordre du Pokédex (vide tant qu'elles ne sont pas données). */
export let SPECIES: readonly PokemonSpecies[] = []

let speciesById = new Map<number, PokemonSpecies>()

/**
 * Demande les espèces au serveur et les donne à l'app ; `false` s'il ne répond pas, ou pas en
 * 15 s (un serveur bloqué donne l'écran « Réessayer », pas une page blanche).
 */
export async function loadSpecies() {
  const file = await getJson<SpeciesFile>('/api/species', 15_000)
  if (file) {
    SPECIES = file.species
    speciesById = new Map(file.species.map((species) => [species.id, species]))
  }
  return file !== null
}

export const getSpecies = (id: number): PokemonSpecies | null => speciesById.get(id) ?? null

/** Les Pokémon d'une carte : plusieurs pour une carte TAG TEAM. */
export const speciesOf = (card: PokemonCard): PokemonSpecies[] =>
  card.dexIds.flatMap((id) => getSpecies(id) ?? [])

/** Les noms de ces Pokémon, en phrase : « Pikachu et Zekrom ». */
export const speciesNames = (ids: readonly number[]) =>
  formatList(ids.map((id) => getSpecies(id)!.names.fr))

/** Les autres Pokémon d'une carte TAG TEAM que celui de la page (`speciesId`) : « Zekrom ». */
export const otherSpeciesNames = (dexIds: readonly number[], speciesId: number) =>
  speciesNames(dexIds.filter((id) => id !== speciesId))

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
export const loadSpeciesDetails = () =>
  derived<SpeciesDetailsFile, Map<number, PokemonSpeciesDetails>>(
    '/api/species/details',
    (file) => new Map((file?.details ?? []).map((entry) => [entry.id, entry])),
  )
