import { Link } from 'react-router'
import { pokedexUrl } from '@/lib/filters'
import { formatInteger } from '@/lib/format'
import type { GenerationProgress } from '@/lib/pokedex'
import styles from './RegionList.module.css'

/**
 * Les régions et leurs Pokémon débloqués, en liste, sur téléphone, où la réglette n'est qu'une
 * image : sous elle sur l'accueil, à sa place sur le Pokédex public. `linked` : chacune mène au
 * Pokédex de sa génération (pas sur le Pokédex public, celui du visiteur).
 */
export function RegionList({
  generations,
  linked = false,
}: {
  generations: GenerationProgress[]
  linked?: boolean
}) {
  return (
    <ul className={styles.regions}>
      {generations.map(({ generation, unlocked, total }) => {
        const content = (
          <>
            <span>{generation.region}</span>
            <span className="muted numeric">
              {formatInteger(unlocked)} sur {formatInteger(total)}
            </span>
          </>
        )
        return (
          <li key={generation.id}>
            {linked ? (
              <Link to={pokedexUrl({ generation: generation.id })} className={styles.region}>
                {content}
              </Link>
            ) : (
              <span className={styles.region}>{content}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
