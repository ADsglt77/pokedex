/**
 * Corrections apportées aux données de TCGdex pour construire l'index. Mesurées en octobre 2026 ;
 * l'app n'en a pas besoin : l'index est déjà classé.
 */

interface SecretCardRule {
  /**
   * Compte officiel de l'extension (le `078` d'une carte `079/078`). Si TCGdex en donne un autre,
   * l'extension a changé : la règle n'est pas appliquée.
   */
  officialCount: number
  /** Classe des Pokémon sans règle qui ouvrent les cartes secrètes (`AR`, `CHR`), ou `null`. */
  plain: string | null
  /**
   * `position` : les trois séries de Pokémon à règle (ex, V…) séparées par des Dresseurs sont
   * SR, SAR puis UR. `unclassified` : toutes en SEC.
   */
  ruleBox: 'position' | 'unclassified'
  /** Libellés TCGdex faux pour les cartes secrètes de l'extension : traités comme absents. */
  ignoredRarities?: readonly string[]
}

const rule = (
  officialCount: number,
  plain: string | null,
  ruleBox: SecretCardRule['ruleBox'],
  ignoredRarities?: readonly string[],
): SecretCardRule => ({ officialCount, plain, ruleBox, ignoredRarities })

/**
 * Extensions dont les cartes secrètes (numérotées au-delà du compte officiel) n'ont pas de
 * rareté utilisable chez TCGdex : leur classe est déduite de leur place (`deduceSecrets.ts`).
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

/** Cartes que leur rareté sélectionnerait à tort. */
export const EXCLUDED_CARD_IDS: ReadonlySet<string> = new Set([
  // 闇からの挑戦 (1999) : cartes ordinaires étiquetées « Hyper rare » et « Ultra Rare ».
  'PMCG6-074',
  'PMCG6-075',
  // GXウルトラシャイニー : Pokémon chromatiques au cadre normal étiquetés « Ultra Rare ».
  ...Array.from({ length: 45 }, (_, index) => `SM8b-${String(161 + index).padStart(3, '0')}`),
])

/** Cartes que TCGdex range sous la mauvaise espèce, vérifiées sur le nom imprimé. */
export const DEX_ID_CORRECTIONS: Readonly<Record<string, number[]>> = {
  'S6K-017': [883],
  'S6K-072': [883],
  'SV-P-132': [569],
}
