import { PokedexTile } from '@/components/PokedexTile'
import { groupByGeneration } from '@/lib/filters'
import { unlockedOf } from '@/lib/format'
import type { GenerationProgress, PokedexEntry } from '@/lib/pokedex'
import styles from './PokedexGrid.module.css'

/** Les premières images se chargent tout de suite, les autres en approchant de l'écran. */
const EAGER_TILES = 12

interface PokedexGridProps {
  entries: PokedexEntry[]
  generations: GenerationProgress[]
}

/** Le classeur : un intertitre par génération dès que la liste en couvre plusieurs. */
export function PokedexGrid({ entries, generations }: PokedexGridProps) {
  const groups = groupByGeneration(entries)
  let rank = 0

  return groups.map(({ generation, entries: groupEntries }) => {
    const progress = generations.find((row) => row.generation.id === generation.id)!
    return (
      <section
        key={generation.id}
        className={styles.group}
        aria-labelledby={groups.length > 1 ? `generation-${generation.id}` : undefined}
      >
        {groups.length > 1 && (
          <h2 id={`generation-${generation.id}`} className={styles.heading}>
            {generation.region}
            <span className={styles.numeral}>{generation.numeral}</span>
            <span className={styles.count}>{unlockedOf(progress)}</span>
          </h2>
        )}
        <ul className={styles.grid}>
          {groupEntries.map((entry) => (
            <li key={entry.species.id}>
              <PokedexTile entry={entry} eager={rank++ < EAGER_TILES} />
            </li>
          ))}
        </ul>
      </section>
    )
  })
}
