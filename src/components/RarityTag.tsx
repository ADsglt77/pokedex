import { Badge, Tooltip } from '@camply/ui'
import type { RarityClass } from '@/config/rarities'
import { cx } from '@/lib/cx'
import { findRarityClass, usableRarityOf } from '@/lib/rarity'
import type { PokemonCard } from '@/types'
import styles from './RarityTag.module.css'

interface RarityTagProps {
  card: PokemonCard
  rarityClass: RarityClass | null
  deduced?: boolean
  /** Affiche aussi le nom de la classe (« AR Art Rare »). */
  withLabel?: boolean
}

/** Code de rareté ; une rareté déduite de la numérotation est marquée d'un astérisque. */
export function RarityTag({ card, rarityClass, deduced, withLabel }: RarityTagProps) {
  const raw = usableRarityOf(card)
  const code = rarityClass?.code ?? raw
  if (!code) return null

  const label = rarityClass?.label ?? findRarityClass(raw)?.label ?? raw ?? code
  const tip = deduced ? `${label}, rareté déduite de la numérotation de la carte` : label

  return (
    <span className={styles.rarity}>
      <Tooltip content={tip}>
        <Badge size="sm" tone="neutral" variant="outline" className={cx(deduced && styles.deduced)}>
          {code}
          {deduced && '*'}
        </Badge>
      </Tooltip>
      {withLabel && label !== code && <span>{label}</span>}
    </span>
  )
}
