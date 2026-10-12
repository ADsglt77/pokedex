/** Classes de rareté : quelle carte peut illustrer un Pokémon. */

import { RARITY_CLASSES, type RarityClass } from '@/config/rarities'
import type { PokemonCard } from '@/types'

/** Un code de rareté (`AR`) → sa classe ; `null` pour le libellé libre d'une carte saisie à la main. */
export const findRarityClass = (code: string | null): RarityClass | null =>
  RARITY_CLASSES.find((rarityClass) => rarityClass.code === code) ?? null

/** Une carte de l'index peut illustrer un Pokémon quand sa classe est suivie. */
export function isEligible(card: PokemonCard, enabledCodes: readonly string[]): boolean {
  const code = findRarityClass(card.rarity)?.code
  return code !== undefined && enabledCodes.includes(code)
}

/** Les codes connus parmi `codes`, dans l'ordre des classes. */
export const knownRarityCodes = (codes: readonly unknown[]) =>
  RARITY_CLASSES.map((rarityClass) => rarityClass.code).filter((code) => codes.includes(code))
