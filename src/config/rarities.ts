/**
 * Quelles cartes comptent comme « illustration complète ».
 * TCGdex publie les raretés japonaises sous des libellés anglais : `aliases` les relie au code
 * imprimé sur les cartes (comparaison insensible à la casse).
 */

export interface RarityClass {
  code: string
  label: string
  tier: 'illustration' | 'fullArt'
  aliases: readonly string[]
  description: string
}

/** Ordonnées par préférence : sans favori, les premières classes gagnent. */
export const RARITY_CLASSES: readonly RarityClass[] = [
  {
    code: 'SAR',
    label: 'Special Art Rare',
    tier: 'illustration',
    aliases: ['Special illustration rare'],
    description:
      'Illustration pleine carte des Pokémon-ex et des Dresseurs, ère Écarlate et Violet.',
  },
  {
    code: 'AR',
    label: 'Art Rare',
    tier: 'illustration',
    aliases: ['Illustration rare'],
    description: 'Illustration pleine carte d’un Pokémon dans son décor.',
  },
  {
    code: 'CSR',
    label: 'Character Super Rare',
    tier: 'illustration',
    aliases: ['Character Super Rare'],
    description: 'Pokémon-V ou VMAX illustré avec son Dresseur, ère Épée et Bouclier.',
  },
  {
    code: 'CHR',
    label: 'Character Rare',
    tier: 'illustration',
    aliases: ['Character Rare'],
    description: 'Pokémon illustré avec son Dresseur.',
  },
  {
    code: 'BWR',
    label: 'Black White Rare',
    tier: 'fullArt',
    aliases: ['Black White Rare'],
    description: 'Pleine carte monochrome des extensions Black Bolt et White Flare.',
  },
  {
    code: 'SSR',
    label: 'Shiny Super Rare',
    tier: 'fullArt',
    aliases: ['Shiny Ultra Rare'],
    description: 'Pleine carte d’un Pokémon chromatique.',
  },
  {
    // TCGdex appelle « Mega Hyper Rare » toutes les cartes dorées depuis 2022 (UR et MUR).
    code: 'UR',
    label: 'Ultra Rare',
    tier: 'fullArt',
    aliases: ['Mega Hyper Rare'],
    description:
      'Pleine carte dorée, y compris les Méga-Pokémon-ex dorés de l’ère MEGA (imprimés MUR).',
  },
  {
    code: 'HR',
    label: 'Hyper Rare',
    tier: 'fullArt',
    aliases: ['Hyper rare'],
    description: 'Pleine carte arc-en-ciel ou dorée.',
  },
  {
    code: 'SR',
    label: 'Super Rare',
    tier: 'fullArt',
    aliases: ['Ultra Rare'],
    description: 'Pleine carte texturée d’un Pokémon-GX, V ou ex sur fond uni.',
  },
  {
    // Aucun libellé TCGdex : une carte n'y arrive que par déduction (index pré-calculé).
    code: 'SEC',
    label: 'Secrète non classée',
    tier: 'fullArt',
    aliases: [],
    description:
      'Pokémon-ex, V, VMAX ou VSTAR numéroté au-delà du compte officiel de son extension, sans rareté exploitable dans TCGdex : SR, SAR, HR, CSR ou UR.',
  },
]

export const DEFAULT_ENABLED_RARITY_CODES: readonly string[] = RARITY_CLASSES.filter(
  (rarityClass) => rarityClass.tier === 'illustration',
).map((rarityClass) => rarityClass.code)

/** Codes renommés : un réglage enregistré sous l'ancien code garde son sens. */
export const RENAMED_RARITY_CODES: Readonly<Record<string, string>> = { MUR: 'UR' }

interface SecretCardRule {
  /**
   * Compte officiel de l'extension (le `078` d'une carte `079/078`) quand la règle a été vérifiée.
   * Si TCGdex en donne un autre, la règle n'est pas appliquée.
   */
  officialCount: number
  /** Classe des Pokémon sans règle qui ouvrent les cartes secrètes (`AR`, `CHR`), ou `null`. */
  plain: string | null
  /**
   * `position` : les trois séries de Pokémon à règle (ex, V…) séparées par des Dresseurs sont
   * SR, SAR puis UR. `unclassified` : toutes en SEC.
   */
  ruleBox: 'position' | 'unclassified'
  /** Libellés TCGdex faux pour les cartes secrètes de l'extension : traités comme « sans rareté ». */
  ignoredRarities?: readonly string[]
}

const rule = (
  officialCount: number,
  plain: string | null,
  ruleBox: SecretCardRule['ruleBox'],
  ignoredRarities?: readonly string[],
): SecretCardRule => ({ officialCount, plain, ruleBox, ignoredRarities })

/**
 * Extensions japonaises dont les cartes secrètes (numérotées au-delà du compte officiel) n'ont
 * pas de rareté exploitable dans TCGdex. Leur classe est déduite de la numérotation par
 * `bun run data:cards` et stockée dans `rarityHint` ; l'app ne fait que la lire. Règle mesurée en
 * octobre 2026 sur les extensions que TCGdex étiquette correctement.
 */
export const SECRET_CARD_RULES: Readonly<Record<string, SecretCardRule>> = {
  // Épée et Bouclier, sans rareté. Seule S9a a des secrètes sans règle (six Character Rare).
  S9: rule(100, null, 'unclassified'),
  S9a: rule(67, 'CHR', 'unclassified'),
  S12: rule(98, null, 'unclassified'),
  // Épée et Bouclier : leurs VMAX et VSTAR Hyper Rare sont étiquetées « Holo Rare ».
  S10P: rule(67, null, 'unclassified', ['Holo Rare']),
  S10a: rule(71, 'CHR', 'unclassified', ['Holo Rare']),
  S11: rule(100, null, 'unclassified', ['Holo Rare']),
  S11a: rule(68, 'CHR', 'unclassified', ['Holo Rare']),
  // Écarlate et Violet, extensions régulières sans rareté.
  SV1S: rule(78, 'AR', 'position'),
  SV1a: rule(73, 'AR', 'position'),
  SV2D: rule(71, 'AR', 'position'),
  SV2P: rule(71, 'AR', 'position'),
  SV3: rule(108, 'AR', 'position'),
  SV3a: rule(62, 'AR', 'position'),
  SV4K: rule(66, 'AR', 'position'),
  SV4M: rule(66, 'AR', 'position'),
  SV5a: rule(66, 'AR', 'position'),
  SV7: rule(102, 'AR', 'position'),
  SV7a: rule(64, 'AR', 'position'),
  // Ses SAR et UR se suivent sans Dresseur entre elles.
  SV9: rule(100, 'AR', 'unclassified'),
  SV9a: rule(63, 'AR', 'position'),
  // MEGA : étiquetées, mais à tort pour leurs secrètes.
  M1S: rule(63, 'AR', 'position', ['Secret Rare']),
  M6: rule(76, 'AR', 'position', ['Mega Hyper Rare']),
}

/** Cartes que la rareté seule sélectionnerait à tort, par id TCGdex. */
export const EXCLUDED_CARD_IDS: ReadonlySet<string> = new Set([
  // 闇からの挑戦 (1999) : cartes ordinaires étiquetées « Hyper rare » et « Ultra Rare ».
  'PMCG6-074',
  'PMCG6-075',
  // GXウルトラシャイニー : Pokémon chromatiques au cadre normal étiquetés « Ultra Rare ».
  ...Array.from({ length: 45 }, (_, index) => `SM8b-${String(161 + index).padStart(3, '0')}`),
])
