/**
 * Les types et les raretés des cartes du catalogue, tels que Pokécardex les numérote (`cards.type`,
 * `cards.rarity`) : configuration, pas de logique.
 */

/**
 * Les types des cartes et leur nom, dans l'ordre des cartes : ceux des Pokémon, puis les catégories
 * des dresseurs et les énergies (Pokécardex les numérote comme des types, sans les nommer : noms
 * d'après ses icônes et ses cartes ; « Dresseur » : une carte d'avant les catégories).
 */
export const CARD_TYPES = new Map([
  [1, 'Plante'],
  [3, 'Feu'],
  [2, 'Eau'],
  [4, 'Électrique'],
  [5, 'Psy'],
  [8, 'Combat'],
  [6, 'Obscurité'],
  [7, 'Métal'],
  [11, 'Fée'],
  [9, 'Dragon'],
  [10, 'Incolore'],
  [13, 'Dresseur'],
  [15, 'Objet'],
  [41, 'Outil'],
  [14, 'Supporter'],
  [12, 'Stade'],
  [16, 'Énergie'],
])

/**
 * Les raretés dont l'icône est noire (●, « SAR »…) : éclaircie sur le thème sombre
 * (`--dark-icon-filter`), comme chez Pokécardex. Les autres sont en couleur.
 */
export const DARK_RARITY_ICONS = new Set([
  1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 28, 29, 30, 31, 44, 46,
])

/** Les catégories des dresseurs parmi les types (`CARD_TYPES`) ; les énergies : `ENERGY_TYPE`. */
export const TRAINER_TYPES = new Set([12, 13, 14, 15, 41])

export const ENERGY_TYPE = 16
