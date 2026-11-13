/**
 * Les types des cartes du catalogue (`CardType` du contrat, les mêmes dans les deux langues) et
 * leur nom : configuration, pas de logique.
 */

import type { CardType, PokemonTypeId } from '@/types'

/**
 * Les types des cartes et leur nom, dans l'ordre des filtres : l'énergie d'un Pokémon, puis les
 * catégories des dresseurs (« Dresseur » : sans précision, une carte d'avant les catégories), puis
 * celles des énergies (« Énergie » : sans précision). Un type absent d'ici n'est pas montré.
 */
export const CARD_TYPES = new Map<CardType, string>([
  ['grass', 'Plante'],
  ['fire', 'Feu'],
  ['water', 'Eau'],
  ['lightning', 'Électrique'],
  ['psychic', 'Psy'],
  ['fighting', 'Combat'],
  ['darkness', 'Obscurité'],
  ['metal', 'Métal'],
  ['fairy', 'Fée'],
  ['dragon', 'Dragon'],
  ['colorless', 'Incolore'],
  ['trainer', 'Dresseur'],
  ['item', 'Objet'],
  ['tool', 'Outil'],
  ['technical-machine', 'Machine technique'],
  ['supporter', 'Supporter'],
  ['stadium', 'Stade'],
  ['basic-energy', 'Énergie de base'],
  ['special-energy', 'Énergie spéciale'],
  ['energy', 'Énergie'],
])

/**
 * L'énergie d'un Pokémon et le type de Pokémon qui lui répond : sa couleur, le jeton
 * `--type-<type>` de `styles/theme.css` (`TypeLabel`, comme `TypeChip`).
 */
export const ENERGY_COLORS = new Map<CardType, PokemonTypeId>([
  ['grass', 'grass'],
  ['fire', 'fire'],
  ['water', 'water'],
  ['lightning', 'electric'],
  ['psychic', 'psychic'],
  ['fighting', 'fighting'],
  ['darkness', 'dark'],
  ['metal', 'steel'],
  ['fairy', 'fairy'],
  ['dragon', 'dragon'],
  ['colorless', 'normal'],
])

/** Les catégories des dresseurs parmi les types (`CARD_TYPES`). */
export const TRAINER_TYPES = new Set<CardType>([
  'trainer',
  'item',
  'tool',
  'technical-machine',
  'supporter',
  'stadium',
])

/** Les catégories des énergies parmi les types (`CARD_TYPES`). */
export const ENERGY_TYPES = new Set<CardType>(['basic-energy', 'special-energy', 'energy'])
