/**
 * Les données embarquées (`src/data`, écrites par `bun run data`) : les 1 025 espèces et l'index
 * des cartes classées. Le Pokédex s'affiche sans aucun appel réseau.
 */

import cardIndexJson from '@/data/card-index.json'
import speciesJson from '@/data/species.json'
import { cardImage } from '@/lib/images'
import type {
  CardIndexFile,
  CardIndexRow,
  PokemonCard,
  PokemonSpecies,
  PokemonSpeciesDetails,
  SpeciesDetailsFile,
  SpeciesFile,
} from '@/types'

const cardIndex = cardIndexJson as CardIndexFile

export const SPECIES = (speciesJson as SpeciesFile).species

const speciesById = new Map(SPECIES.map((species) => [species.id, species]))

export const getSpecies = (id: number): PokemonSpecies | null => speciesById.get(id) ?? null

export const CARD_INDEX_INFO = {
  generatedAt: cardIndex.generatedAt,
  cardCount: cardIndex.cards.length,
}

const ID_PREFIX = 'tcgdex:ja:'

/** `tcgdex:ja:SV2a-173` → `SV2a-173` ; `null` pour une carte saisie dans une ancienne version. */
export const tcgdexIdOf = (card: PokemonCard) =>
  card.id.startsWith(ID_PREFIX) ? card.id.slice(ID_PREFIX.length) : null

/** Une ligne de l'index → la carte affichée. */
function toCard(row: CardIndexRow): PokemonCard {
  const set = cardIndex.sets[row.set]
  return {
    id: ID_PREFIX + row.id,
    dexIds: row.dexIds,
    name: row.name,
    reference: `${row.set} ${row.number}`,
    set: { id: row.set, name: set?.name ?? null, releaseDate: set?.releaseDate ?? null },
    rarity: row.rarity,
    deduced: row.deduced,
    illustrator: row.illustrator,
    image: cardImage(row.image),
  }
}

const INDEX_CARDS = cardIndex.cards.map(toCard)
const cardById = new Map(INDEX_CARDS.map((card) => [card.id, card]))

export const indexCard = (id: string): PokemonCard | null => cardById.get(id) ?? null

/** Les cartes de chaque espèce ; une carte TAG TEAM est rangée sous chacune. */
const cardsBySpecies = new Map<number, PokemonCard[]>()
for (const card of INDEX_CARDS) {
  for (const speciesId of card.dexIds) {
    const cards = cardsBySpecies.get(speciesId) ?? []
    cardsBySpecies.set(speciesId, cards)
    cards.push(card)
  }
}

export const indexCardsFor = (speciesId: number): readonly PokemonCard[] =>
  cardsBySpecies.get(speciesId) ?? []

let speciesDetails: Promise<Map<number, PokemonSpeciesDetails>> | null = null

/**
 * Description, taille, poids… : un fichier à part, chargé à la première fiche ouverte. Toujours
 * la même promesse, lue par `use()`.
 */
export function loadSpeciesDetails() {
  speciesDetails ??= import('@/data/species-details.json').then(
    ({ default: file }) =>
      new Map((file as SpeciesDetailsFile).details.map((details) => [details.id, details])),
  )
  return speciesDetails
}
