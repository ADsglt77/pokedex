import { Progress, Tooltip } from '@camply/ui'
import { Link } from 'react-router'
import { cx } from '@/lib/cx'
import { formatInteger, unlockedOf } from '@/lib/format'
import type { GenerationProgress } from '@/lib/pokedex'
import type { GenerationId } from '@/types'
import styles from './ProgressRuler.module.css'

interface ProgressRulerProps {
  generations: GenerationProgress[]
  /** Génération mise en avant (filtre actif). */
  selected?: GenerationId | null
  /** Chaque segment filtre le Pokédex sur sa génération ; sans `onSelect`, il y mène. */
  onSelect?: (generation: GenerationId | null) => void
}

/**
 * La réglette : une barre par génération, large comme sa part du Pokédex, remplie de ce qui
 * est débloqué. Les libellés disparaissent quand la place manque.
 */
export function ProgressRuler({ generations, selected = null, onSelect }: ProgressRulerProps) {
  return (
    <div className={styles.ruler}>
      {generations.map((row) => {
        const { generation, unlocked, total, percent } = row
        const content = (
          <>
            {/* Un premier Pokémon débloqué se voit, même sur 151. */}
            <Progress size="sm" value={unlocked > 0 ? Math.max(percent, 3) : 0} aria-hidden />
            <span className={styles.label}>
              <span className={styles.region}>{generation.region}</span>
              <span className={styles.numeral}>{generation.numeral}</span>
              <span className={styles.count}>
                {formatInteger(unlocked)} / {formatInteger(total)}
              </span>
            </span>
          </>
        )
        const props = {
          className: cx(styles.segment, selected === generation.id && styles.selected),
          style: { flexGrow: total },
        }
        const tip = `${generation.region} : ${unlockedOf(row)}`

        return (
          <Tooltip key={generation.id} content={tip}>
            {onSelect ? (
              <button
                {...props}
                type="button"
                aria-pressed={selected === generation.id}
                onClick={() => onSelect(selected === generation.id ? null : generation.id)}
              >
                {content}
              </button>
            ) : (
              <Link {...props} to={`/pokedex?generation=${generation.id}`}>
                {content}
              </Link>
            )}
          </Tooltip>
        )
      })}
    </div>
  )
}
