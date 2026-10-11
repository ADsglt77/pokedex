import { Badge, Tooltip } from '@camply/ui'
import { cx } from '@/lib/cx'
import { findRarityClass } from '@/lib/rarity'
import type { PokemonCard } from '@/types'
import styles from './RarityTag.module.css'

/**
 * Le code de rareté d'une carte (« AR »), et son nom au survol ; un astérisque quand la classe
 * est déduite de la numérotation. `withLabel` affiche aussi le nom (« AR Art Rare »).
 */
export function RarityTag({ card, withLabel }: { card: PokemonCard; withLabel?: boolean }) {
  const rarityClass = findRarityClass(card.rarity)
  const code = rarityClass?.code ?? card.rarity
  if (!code) return null
  const label = rarityClass?.label ?? code

  return (
    <span className={styles.rarity}>
      <Tooltip content={card.deduced ? `${label}, rareté déduite de la numérotation` : label}>
        <Badge
          size="sm"
          tone="neutral"
          variant="outline"
          className={cx(card.deduced && styles.deduced)}
        >
          {code}
          {card.deduced && '*'}
        </Badge>
      </Tooltip>
      {withLabel && label !== code && <span>{label}</span>}
    </span>
  )
}
