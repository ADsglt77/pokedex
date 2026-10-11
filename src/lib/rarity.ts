/** Classes de rareté : quelle carte peut illustrer un Pokémon. */

import { RARITY_CLASSES, type RarityClass } from '@/config/rarities'
import type { PokemonCard } from '@/types'

const normalize = (label: string) => label.trim().toLowerCase()

/** Un code (`AR`) ou un libellé TCGdex (`Illustration rare`) → sa classe. */
const CLASS_BY_LABEL = new Map(
  RARITY_CLASSES.flatMap((rarityClass) =>
    [rarityClass.code, ...rarityClass.aliases].map((label) => [normalize(label), rarityClass]),
  ),
)

export const findRarityClass = (label: string | null): RarityClass | null =>
  (label && CLASS_BY_LABEL.get(normalize(label))) || null

/** Une carte de l'index peut illustrer un Pokémon quand sa classe est suivie. */
export function isEligible(card: PokemonCard, enabledCodes: readonly string[]): boolean {
  const code = findRarityClass(card.rarity)?.code
  return code !== undefined && enabledCodes.includes(code)
}

/** Les codes connus parmi `codes`, dans l'ordre des classes. */
export const knownRarityCodes = (codes: readonly unknown[]) =>
  RARITY_CLASSES.map((rarityClass) => rarityClass.code).filter((code) => codes.includes(code))
