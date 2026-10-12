/** Les classes de pleines cartes : quelles cartes peuvent illustrer un Pokémon. */

export interface RarityClass {
  code: string
  label: string
  tier: 'illustration' | 'fullArt'
  description: string
}

/** Ordonnées par préférence : sans favori, les premières classes gagnent. */
export const RARITY_CLASSES: readonly RarityClass[] = [
  {
    code: 'SAR',
    label: 'Special Art Rare',
    tier: 'illustration',
    description:
      'Illustration pleine carte des Pokémon-ex et des Dresseurs, ère Écarlate et Violet.',
  },
  {
    code: 'AR',
    label: 'Art Rare',
    tier: 'illustration',
    description: 'Illustration pleine carte d’un Pokémon dans son décor.',
  },
  {
    code: 'CSR',
    label: 'Character Super Rare',
    tier: 'illustration',
    description: 'Pokémon-V ou VMAX illustré avec son Dresseur, ère Épée et Bouclier.',
  },
  {
    code: 'CHR',
    label: 'Character Rare',
    tier: 'illustration',
    description: 'Pokémon illustré avec son Dresseur.',
  },
  {
    // Une promo n'entre dans l'index que par la liste tenue à la main (`FULL_ART_PROMO_IDS`).
    code: 'PR',
    label: 'Promo pleine carte',
    tier: 'illustration',
    description:
      'Carte promotionnelle en illustration pleine carte, choisie à la main : aucune rareté imprimée ne la distingue.',
  },
  {
    code: 'BWR',
    label: 'Black White Rare',
    tier: 'fullArt',
    description: 'Pleine carte monochrome des extensions Black Bolt et White Flare.',
  },
  {
    code: 'SSR',
    label: 'Shiny Super Rare',
    tier: 'fullArt',
    description: 'Pleine carte d’un Pokémon chromatique.',
  },
  {
    code: 'UR',
    label: 'Ultra Rare',
    tier: 'fullArt',
    description:
      'Pleine carte dorée, y compris les Méga-Pokémon-ex dorés de l’ère MEGA (imprimés MUR).',
  },
  {
    code: 'HR',
    label: 'Hyper Rare',
    tier: 'fullArt',
    description: 'Pleine carte arc-en-ciel ou dorée.',
  },
  {
    code: 'SR',
    label: 'Super Rare',
    tier: 'fullArt',
    description: 'Pleine carte texturée d’un Pokémon-GX, V ou ex sur fond uni.',
  },
]

/** Par défaut, toutes les pleines cartes comptent ; on peut en écarter dans Données. */
export const DEFAULT_ENABLED_RARITY_CODES: readonly string[] = RARITY_CLASSES.map(
  (rarityClass) => rarityClass.code,
)
