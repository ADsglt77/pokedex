import { Badge, Tooltip } from '@camply/ui'
import { findRarityClass } from '@/lib/rarity'
import type { PokemonCard } from '@/types'
import styles from './RarityTag.module.css'

/** Le code de rareté d'une carte (« AR »), et son nom au survol ; `withLabel` affiche aussi le nom. */
export function RarityTag({ card, withLabel }: { card: PokemonCard; withLabel?: boolean }) {
  const code = card.rarity
  if (!code) return null
  const label = findRarityClass(code)?.label ?? code

  return (
    <span className={styles.rarity}>
      <Tooltip content={label}>
        <Badge size="sm" tone="neutral" variant="outline">
          {code}
        </Badge>
      </Tooltip>
      {/* Le nom au survol seulement ne servirait ni au clavier ni aux lecteurs d'écran. */}
      {label !== code && <span className={withLabel ? undefined : 'visually-hidden'}>{label}</span>}
    </span>
  )
}
