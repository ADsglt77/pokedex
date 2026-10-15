import { memo } from 'react'
import { PokedexTile } from './PokedexTile'
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

/**
 * Le classeur : un intertitre par génération dès que la liste en couvre plusieurs (pas des régions
 * nommées : neuf points de repère de plus, les titres suffisent à s'y retrouver). Mémoïsé : à
 * chaque frappe, le rendu urgent garde l'ancienne liste et passe la grille (environ 1 000 tuiles).
 */
export const PokedexGrid = memo(function PokedexGrid({ entries, generations }: PokedexGridProps) {
  const groups = groupByGeneration(entries)
  let rank = 0

  return groups.map(({ generation, entries: groupEntries }) => {
    const progress = generations.find((row) => row.generation.id === generation.id)!
    return (
      <section key={generation.id} className={styles.group}>
        {groups.length > 1 && (
          <div className={styles.heading}>
            <h2>
              {generation.region}{' '}
              <span className={styles.numeral}>génération {generation.numeral}</span>
            </h2>
            <span className={styles.count}>{unlockedOf(progress)}</span>
          </div>
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
})
