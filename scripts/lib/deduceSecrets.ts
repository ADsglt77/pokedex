/**
 * Classe des cartes secrètes qu'une extension de `SECRET_CARD_RULES` publie sans rareté
 * exploitable, déduite de leur place dans l'extension. Seule la classe est déduite : chaque
 * carte existe bel et bien dans TCGdex.
 */

import { SECRET_CARD_RULES } from '@/config/rarities'
import { usableRarity } from '@/lib/rarity'

/** Ce que la déduction lit d'une carte. Toutes les cartes de l'extension, Dresseurs compris. */
export interface SetCard {
  id: string
  number: string
  name: string | null
  isPokemon: boolean
  rarity: string | null
}

/** Fins de nom des Pokémon à règle (ex, EX, GX, V, VMAX, VSTAR, V-UNION) sur les cartes japonaises. */
const RULE_BOX_ENDINGS = ['ex', 'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'V-UNION']

/** Classes des trois séries de Pokémon à règle d'une extension `position`, dans l'ordre. */
const POSITION_CODES = ['SR', 'SAR', 'UR']

function isRuleBox(name: string | null) {
  const printed = name?.trim() ?? ''
  return RULE_BOX_ENDINGS.some((end) => printed.length > end.length && printed.endsWith(end))
}

/**
 * - Les Pokémon sans règle qui ouvrent les secrètes (numéros consécutifs dès le compte
 *   officiel + 1) prennent la classe `plain` de la règle.
 * - Les Pokémon à règle prennent la classe de leur série (SR, SAR, UR) quand la règle dit
 *   `position` et que les secrètes montrent exactement trois séries, sans trou ; sinon SEC.
 * - Les Dresseurs et Énergies ne font que séparer les séries.
 *
 * Rien n'est déduit si TCGdex donne un autre compte officiel que celui de la règle, ni pour
 * une carte qui a une rareté exploitable. Rend la classe par id TCGdex.
 */
export function deduceSecrets(
  setId: string,
  officialCount: number | null,
  cards: readonly SetCard[],
): Map<string, string> {
  const hints = new Map<string, string>()
  const rule = SECRET_CARD_RULES[setId]
  if (!rule || officialCount !== rule.officialCount) return hints

  const secret = cards
    .filter((card) => /^\d+$/.test(card.number) && Number(card.number) > officialCount)
    .map((card) => ({
      card,
      number: Number(card.number),
      kind: !card.isPokemon ? 'other' : isRuleBox(card.name) ? 'ruleBox' : 'plain',
    }))
    .sort((a, b) => a.number - b.number)
  const contiguous = secret.every((item, index) => item.number === officialCount + 1 + index)

  let opening = 0
  while (
    secret[opening]?.kind === 'plain' &&
    secret[opening]?.number === officialCount + 1 + opening
  ) {
    opening++
  }

  const classes = new Map<SetCard, string>()
  if (rule.plain) for (const { card } of secret.slice(0, opening)) classes.set(card, rule.plain)

  // Séries de Pokémon à règle consécutifs, séparées par tout le reste.
  const afterOpening = secret.slice(opening)
  const runs: SetCard[][] = []
  afterOpening.forEach((item, index) => {
    if (item.kind !== 'ruleBox') return
    if (afterOpening[index - 1]?.kind === 'ruleBox') runs.at(-1)!.push(item.card)
    else runs.push([item.card])
  })
  const byPosition =
    rule.ruleBox === 'position' &&
    contiguous &&
    runs.length === POSITION_CODES.length &&
    afterOpening.every((item) => item.kind !== 'plain')
  runs.forEach((run, index) => {
    for (const card of run) classes.set(card, (byPosition && POSITION_CODES[index]) || 'SEC')
  })

  for (const [card, code] of classes) {
    if (usableRarity(card.rarity, setId) === null) hints.set(card.id, code)
  }
  return hints
}
