/**
 * Données de référence livrées avec l'app (générées depuis PokéAPI et TCGdex) : la grille
 * s'affiche sans aucun appel réseau.
 */

import cardIndexJson from '@/data/card-index.json'
import speciesJson from '@/data/species.json'
import { normalizeTcgdexCard } from '@/lib/tcgdex'
import type {
  CardIndexFile,
  CardSet,
  PokemonCard,
  PokemonSpecies,
  PokemonSpeciesDetails,
  SpeciesDetailsFile,
  SpeciesFile,
} from '@/types'

const cardIndex = cardIndexJson as CardIndexFile

export const SPECIES = (speciesJson as SpeciesFile).species

const speciesById = new Map(SPECIES.map((species) => [species.id, species]))

export function getSpecies(id: number): PokemonSpecies | null {
  return speciesById.get(id) ?? null
}

const SETS = new Map<string, CardSet>(
  Object.entries(cardIndex.sets).map(([id, set]) => [
    id,
    { id, name: set.name, releaseDate: set.releaseDate },
  ]),
)

const INDEX_CARDS: PokemonCard[] = cardIndex.cards.flatMap((row) => {
  const card = normalizeTcgdexCard(
    { ...row, set: undefined, localId: row.number, dexId: row.dexIds },
    SETS.get(row.set) ?? { id: row.set, name: null, releaseDate: null },
  )
  if (card === null) return []
  return row.rarityHint ? [{ ...card, rarityHint: row.rarityHint }] : [card]
})

export const CARD_INDEX_INFO = {
  generatedAt: cardIndex.generatedAt,
  cardCount: INDEX_CARDS.length,
}

const indexById = new Map(INDEX_CARDS.map((card) => [card.id, card]))

export function indexCard(cardId: string): PokemonCard | null {
  return indexById.get(cardId) ?? null
}

/** Regroupe des cartes par espèce ; une carte TAG TEAM apparaît sous chacune. */
function groupBySpecies(cards: Iterable<PokemonCard>): Map<number, PokemonCard[]> {
  const groups = new Map<number, PokemonCard[]>()
  for (const card of cards) {
    for (const speciesId of card.dexIds) {
      const group = groups.get(speciesId)
      if (group) group.push(card)
      else groups.set(speciesId, [card])
    }
  }
  return groups
}

const indexBySpecies = groupBySpecies(INDEX_CARDS)

export function indexCardsFor(speciesId: number): readonly PokemonCard[] {
  return indexBySpecies.get(speciesId) ?? []
}

let speciesDetails: Promise<Map<number, PokemonSpeciesDetails>> | null = null

/**
 * Détails des espèces (description, taille…), chargés à la première fiche ouverte. Toujours la
 * même promesse (lue par `use()`). Un échec (hors ligne, site redéployé entre-temps) donne une
 * fiche sans détails plutôt qu'une page d'erreur, et la fiche suivante réessaie.
 */
export function loadSpeciesDetails() {
  speciesDetails ??= import('@/data/species-details.json').then(
    ({ default: file }) =>
      new Map((file as SpeciesDetailsFile).details.map((details) => [details.id, details])),
    () => {
      speciesDetails = null
      return new Map<number, PokemonSpeciesDetails>()
    },
  )
  return speciesDetails
}
