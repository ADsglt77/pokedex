/** Les cartes de TCGdex vues par les scripts : ce qu'on en garde, et leur classe de rareté. */

import { TOTAL_SPECIES } from '@/config/pokedex'
import { findRarityClass } from '@/lib/rarity'
import { DEX_ID_CORRECTIONS, SECRET_CARD_RULES } from './rules'

/** Une carte renvoyée par TCGdex (GraphQL) : les champs facultatifs peuvent valoir `null`. */
export interface TcgdexCard {
  id: string
  localId: string
  name?: string | null
  rarity?: string | null
  illustrator?: string | null
  image?: string | null
  dexId?: number[] | null
  set: { id: string }
}

/** Ce que l'index garde d'une carte avant de la classer. */
export interface Card {
  id: string
  set: string
  number: string
  name: string | null
  /** Libellé TCGdex (`Illustration rare`). */
  rarity: string | null
  illustrator: string | null
  /** Base d'image TCGdex. */
  image: string | null
  dexIds: number[]
}

const text = (value: string | null | undefined) => value?.trim() || null

export function readCard(card: TcgdexCard): Card {
  const dexIds = DEX_ID_CORRECTIONS[card.id] ?? card.dexId ?? []
  return {
    id: card.id,
    set: card.set.id,
    number: card.localId,
    name: text(card.name),
    rarity: text(card.rarity),
    illustrator: text(card.illustrator),
    image: text(card.image),
    dexIds: [...new Set(dexIds)].filter((id) => id >= 1 && id <= TOTAL_SPECIES),
  }
}

/**
 * La rareté si elle dit quelque chose : ni vide, ni « None », ni un libellé que la règle des
 * cartes secrètes de l'extension déclare faux.
 */
export function usableRarity(rarity: string | null, setId: string): string | null {
  const ignored = ['none', ...(SECRET_CARD_RULES[setId]?.ignoredRarities ?? [])]
  return rarity && !ignored.some((label) => label.toLowerCase() === rarity.toLowerCase())
    ? rarity
    : null
}

/**
 * La classe d'une carte : celle de sa rareté quand elle est utilisable (une « Common » reste sans
 * classe), sinon celle déduite de sa place dans l'extension (`deduced`, voir `deduceSecrets.ts`).
 */
export function classify(card: Card, deduced: string | undefined) {
  const rarity = usableRarity(card.rarity, card.set)
  if (rarity) return { code: findRarityClass(rarity)?.code ?? null, deduced: false }
  return { code: deduced ?? null, deduced: deduced !== undefined }
}
