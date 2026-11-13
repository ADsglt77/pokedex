import { CARD_TYPES, ENERGY_COLORS } from '@/config/catalog'
import type { CardType } from '@/types'
import styles from './TypeLabel.module.css'

/**
 * Le type d'une carte du catalogue, en toutes lettres (`CARD_TYPES`) ; pour l'énergie d'un
 * Pokémon, précédé de la pastille de sa couleur (celle du type de Pokémon qui lui répond,
 * `ENERGY_COLORS`, comme `TypeChip`). Les filtres du catalogue, la fiche d'une carte.
 */
export function TypeLabel({ type }: { type: CardType }) {
  const color = ENERGY_COLORS.get(type)
  return (
    <span className={styles.label}>
      {color && (
        <span
          className={styles.dot}
          style={{ background: `var(--type-${color})` }}
          aria-hidden="true"
        />
      )}
      {CARD_TYPES.get(type)}
    </span>
  )
}
