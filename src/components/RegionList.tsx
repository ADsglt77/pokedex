import { formatInteger } from '@/lib/format'
import type { GenerationProgress } from '@/lib/pokedex'
import styles from './RegionList.module.css'

/**
 * Les régions et leurs Pokémon débloqués, en liste : sur téléphone, à la place de la réglette du
 * Pokédex public. Sans lien : ce serait le Pokédex du visiteur.
 */
export function RegionList({ generations }: { generations: GenerationProgress[] }) {
  return (
    <ul className={styles.regions}>
      {generations.map(({ generation, unlocked, total }) => (
        <li key={generation.id}>
          <span className={styles.region}>
            <span>{generation.region}</span>
            <span className="muted numeric">
              {formatInteger(unlocked)} sur {formatInteger(total)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
