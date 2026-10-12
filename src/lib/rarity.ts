/** Classes de rareté : quelle carte peut illustrer un Pokémon. */

import { RARITY_CLASSES, type RarityClass } from '@/config/rarities'
import type { PokemonCard } from '@/types'

/** Un code de rareté (`AR`) → sa classe ; `null` pour le libellé libre d'une carte saisie à la main. */
export const findRarityClass = (code: string | null): RarityClass | null =>
  RARITY_CLASSES.find((rarityClass) => rarityClass.code === code) ?? null

/**
 * Une carte de l'index (toujours d'une classe connue) peut illustrer un Pokémon quand sa classe est
 * suivie.
 */
export const isEligible = (card: PokemonCard, enabledCodes: readonly string[]) =>
  card.rarity !== null && enabledCodes.includes(card.rarity)
