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
