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
    // Reconnue à l'image, ou notée à la main (`FULL_ART_CLASSES`) : aucune rareté ne la distingue.
    code: 'PR',
    label: 'Pleine carte hors rareté',
    tier: 'illustration',
    description:
      'Illustration pleine carte sans rareté qui la distingue : promos, decks, coffrets, collections…',
  },
  {
    code: 'BWR',
    label: 'Black White Rare',
    tier: 'fullArt',
    description:
      'Pleine carte monochrome : Black Bolt et White Flare, les Mew RGB de 30th CELEBRATION.',
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
      'Pleine carte dorée (parfois argentée), y compris les Méga-Pokémon-ex dorés de l’ère MEGA (imprimés MUR).',
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
    description: 'Pleine carte texturée d’un Pokémon-EX, GX, V ou ex.',
  },
  {
    code: 'RR',
    label: 'GX et V',
    tier: 'fullArt',
    description:
      'Pokémon-GX, TAG TEAM et Pokémon-V ordinaires : l’illustration couvre déjà la carte.',
  },
  {
    code: 'RRR',
    label: 'VMAX et VSTAR',
    tier: 'fullArt',
    description:
      'Pokémon-VMAX et VSTAR ordinaires (et V-UNION) : l’illustration couvre déjà la carte.',
  },
]

/**
 * Par défaut, toutes les pleines cartes comptent ; on peut en écarter dans Données. Une classe
 * ajoutée ici n'est suivie que dans les navigateurs sans réglages enregistrés : ailleurs (ou après
 * l'import d'un ancien export), l'activer dans Données, ou « Rétablir les réglages par défaut ».
 */
export const DEFAULT_ENABLED_RARITY_CODES: readonly string[] = RARITY_CLASSES.map(
  (rarityClass) => rarityClass.code,
)
