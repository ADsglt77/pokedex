import { Badge } from '@camply/ui'
import { POKEMON_TYPES } from '@/config/pokedex'
import type { PokemonTypeId } from '@/types'
import styles from './TypeChip.module.css'

/** Le type d'un Pokémon : sa couleur (un jeton de `styles/theme.css`, `--type-fire`…) et son nom. */
export function TypeChip({ type }: { type: PokemonTypeId }) {
  return (
    <Badge
      variant="outline"
      tone="neutral"
      icon={<span className={styles.dot} style={{ background: `var(--type-${type})` }} />}
    >
      {POKEMON_TYPES[type]}
    </Badge>
  )
}
