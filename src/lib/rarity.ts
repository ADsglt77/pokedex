import {
  DEFAULT_ENABLED_RARITY_CODES,
  EXCLUDED_CARD_IDS,
  RARITY_CLASSES,
  RENAMED_RARITY_CODES,
  SECRET_CARD_RULES,
  type RarityClass,
} from '@/config/rarities'
import type { PokemonCard } from '@/types'

type ClassifiableCard = Pick<PokemonCard, 'id' | 'source' | 'rarity' | 'rarityHint'>

const normalize = (label: string) => label.trim().toLowerCase()

function indexClasses(labelsOf: (rarityClass: RarityClass) => readonly string[]) {
  const index = new Map<string, RarityClass>()
  for (const rarityClass of RARITY_CLASSES) {
    for (const label of labelsOf(rarityClass)) {
      // La première classe gagne : l'ordre de RARITY_CLASSES tranche un libellé en double.
      if (!index.has(normalize(label))) index.set(normalize(label), rarityClass)
    }
  }
  return index
}

const CLASS_BY_CODE = indexClasses((rarityClass) => [rarityClass.code])
const CLASS_BY_ALIAS = indexClasses((rarityClass) => rarityClass.aliases)

function findRarityClassByCode(code: string | null | undefined): RarityClass | null {
  return code ? (CLASS_BY_CODE.get(normalize(code)) ?? null) : null
}

/** Par code (`AR`) ou par libellé TCGdex (`Illustration rare`). */
export function findRarityClass(label: string | null | undefined): RarityClass | null {
  if (!label) return null
  return CLASS_BY_CODE.get(normalize(label)) ?? CLASS_BY_ALIAS.get(normalize(label)) ?? null
}

/** `tcgdex:ja:SV6a-065` → `SV6a-065` ; `null` pour une carte manuelle. */
export function tcgdexIdOf(card: Pick<PokemonCard, 'id' | 'source'>): string | null {
  if (card.source !== 'tcgdex') return null
  return /^tcgdex:[^:]+:(.+)$/.exec(card.id)?.[1] ?? null
}

/** Un id TCGdex est `<extension>-<numéro>`, et l'id d'extension peut contenir un tiret (`SV-P`). */
function setIdOf(tcgdexId: string): string {
  return tcgdexId.slice(0, tcgdexId.lastIndexOf('-'))
}

/**
 * La rareté si elle dit quelque chose : ni vide, ni « None », ni un libellé que la règle des
 * cartes secrètes de l'extension déclare faux. `setId` : extension TCGdex de la carte.
 */
export function usableRarity(rarity: string | null | undefined, setId: string | null) {
  const label = rarity?.trim()
  if (!label || normalize(label) === 'none') return null
  const ignored = setId === null ? undefined : SECRET_CARD_RULES[setId]?.ignoredRarities
  return ignored?.some((wrong) => normalize(wrong) === normalize(label)) ? null : label
}

export function usableRarityOf(card: Pick<PokemonCard, 'id' | 'source' | 'rarity'>) {
  const tcgdexId = tcgdexIdOf(card)
  return usableRarity(card.rarity, tcgdexId === null ? null : setIdOf(tcgdexId))
}

interface Classification {
  rarityClass: RarityClass | null
  /** La classe vient de la numérotation de la carte, pas de la source. */
  deduced: boolean
}

/**
 * Classe d'une carte : la rareté de la source si elle est exploitable (une carte « Common »
 * n'est jamais promue), sinon la classe déduite à la construction de l'index.
 */
export function classifyCard(card: ClassifiableCard): Classification {
  const rarity = usableRarityOf(card)
  if (rarity !== null) return { rarityClass: findRarityClass(rarity), deduced: false }
  const deduced = findRarityClassByCode(card.rarityHint)
  return { rarityClass: deduced, deduced: deduced !== null }
}

/** Une carte du catalogue est candidate quand sa classe fait partie des classes suivies. */
export function isEligible(card: ClassifiableCard, enabledCodes: readonly string[]): boolean {
  const tcgdexId = tcgdexIdOf(card)
  if (tcgdexId !== null && EXCLUDED_CARD_IDS.has(tcgdexId)) return false
  const code = classifyCard(card).rarityClass?.code
  return code !== undefined && enabledCodes.includes(code)
}

/** Codes connus, dans l'ordre des classes ; une liste illisible revient aux réglages par défaut. */
export function normalizeRarityCodes(codes: readonly unknown[]): string[] {
  const wanted = new Set(
    codes
      .filter((code): code is string => typeof code === 'string')
      .map((code) => RENAMED_RARITY_CODES[code.toUpperCase()] ?? code.toUpperCase()),
  )
  const known = RARITY_CLASSES.map((rarityClass) => rarityClass.code).filter((code) =>
    wanted.has(code),
  )
  // Une liste vide est un choix ; une liste qui ne contient que des inconnus ne l'est pas.
  return known.length === 0 && codes.length > 0 ? [...DEFAULT_ENABLED_RARITY_CODES] : known
}
