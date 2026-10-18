import { memo, type CSSProperties } from 'react'
import { PokedexTile } from './PokedexTile'
import { groupByGeneration } from '@/lib/filters'
import { unlockedOf } from '@/lib/format'
import type { GenerationProgress, PokedexEntry } from '@/lib/pokedex'
import styles from './PokedexGrid.module.css'

/** Les premières images se chargent tout de suite, les autres en approchant de l'écran. */
const EAGER_TILES = 12

interface PokedexGridProps {
  /** Dans l'ordre de la grille. */
  entries: PokedexEntry[]
  /**
   * Les Pokémon montrés (numéros) ; les autres pochettes restent, masquées : un filtre ou une
   * frappe ne refait pas des centaines de pochettes. Sans : toutes.
   */
  shown?: ReadonlySet<number>
  generations: GenerationProgress[]
  /**
   * Faux sur le Pokédex public : les pochettes ne mènent pas aux fiches. Vrai, ce sont de simples
   * liens : la page les fait suivre par le routeur (`PokedexPage`).
   */
  linked?: boolean
  /** Le niveau des intertitres des générations : 3 sous un titre de section (Pokédex public). */
  headingLevel?: 2 | 3
}

/**
 * Le classeur : un intertitre par génération dès que la liste montrée en couvre plusieurs (pas des
 * régions nommées : neuf points de repère de plus, les titres suffisent à s'y retrouver). Mémoïsé :
 * à chaque frappe, le rendu urgent garde l'ancienne liste et passe la grille (environ 1 000 tuiles).
 */
export const PokedexGrid = memo(function PokedexGrid({
  entries,
  shown,
  generations,
  linked,
  headingLevel = 2,
}: PokedexGridProps) {
  const groups = groupByGeneration(entries)
  const isShown = (entry: PokedexEntry) => !shown || shown.has(entry.species.id)
  const shownGroups = groups.filter((group) => group.entries.some(isShown)).length
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  let rank = 0

  return groups.map(({ generation, entries: groupEntries }) => {
    const progress = generations.find((row) => row.generation.id === generation.id)!
    const tiles = groupEntries.filter(isShown).length
    return (
      <section
        key={generation.id}
        className={styles.group}
        hidden={tiles === 0}
        // Sa hauteur estimée tant qu'elle n'a pas été montrée (`PokedexGrid.module.css`).
        style={{ '--tiles': tiles } as CSSProperties}
      >
        {shownGroups > 1 && (
          <div className={styles.heading}>
            <Heading>
              {generation.region}{' '}
              <span className={styles.numeral}>génération {generation.numeral}</span>
            </Heading>
            <span className={styles.count}>{unlockedOf(progress)}</span>
          </div>
        )}
        <ul className={styles.grid}>
          {groupEntries.map((entry) => {
            const visible = isShown(entry)
            return (
              <li key={entry.species.id} hidden={!visible}>
                <PokedexTile
                  entry={entry}
                  eager={visible && rank++ < EAGER_TILES}
                  linked={linked}
                />
              </li>
            )
          })}
        </ul>
      </section>
    )
  })
})
