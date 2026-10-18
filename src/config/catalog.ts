/**
 * Les types et les raretés des cartes du catalogue, tels que Pokécardex les numérote (`cards.type`,
 * `cards.rarity`) : configuration, pas de logique.
 */

/**
 * Les types des cartes Pokémon et leur nom, dans l'ordre des cartes. Les autres numéros de
 * Pokécardex sont ceux des dresseurs et des énergies, absents du catalogue.
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
])

/**
 * Les raretés dont l'icône est noire (●, « SAR »…) : éclaircie sur le thème sombre
 * (`--dark-icon-filter`), comme chez Pokécardex. Les autres sont en couleur.
 */
export const DARK_RARITY_ICONS = new Set([
  1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 28, 29, 30, 31, 44, 46,
])
