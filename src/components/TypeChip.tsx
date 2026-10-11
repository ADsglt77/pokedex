import { Badge } from '@camply/ui'
import { POKEMON_TYPES } from '@/config/pokedex'
import type { PokemonTypeId } from '@/types'
import styles from './TypeChip.module.css'

export function TypeChip({ type }: { type: PokemonTypeId }) {
  const { label, color } = POKEMON_TYPES[type]
  return (
    <Badge
      variant="outline"
      tone="neutral"
      icon={<span className={styles.dot} style={{ background: color }} />}
    >
      {label}
    </Badge>
  )
}
