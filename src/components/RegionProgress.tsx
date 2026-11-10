import { Link } from 'react-router'
import { ProgressRuler } from '@/components/ProgressRuler'
import { usePhone } from '@/hooks/useMediaQuery'
import { cx } from '@/lib/cx'
import { pokedexUrl } from '@/lib/filters'
import { formatInteger } from '@/lib/format'
import type { GenerationProgress } from '@/lib/pokedex'
import styles from './RegionProgress.module.css'

/**
 * La progression par région (l'accueil, le Pokédex public) : la réglette (`ProgressRuler`) ; sur
 * téléphone, où ses segments seraient trop petits pour un doigt et sans nom lisible, la liste des
 * régions. `linked` : chaque région mène au Pokédex filtré sur elle (l'accueil ; en liste, une ligne
 * entière à toucher). Pas sur le Pokédex public : ce serait le Pokédex du visiteur.
 */
export function RegionProgress({
  generations,
  linked,
}: {
  generations: GenerationProgress[]
  linked: boolean
}) {
  return usePhone() ? (
    <RegionList generations={generations} linked={linked} />
  ) : (
    <ProgressRuler generations={generations} linked={linked} />
  )
}

/** Les régions et leurs Pokémon débloqués, en liste. */
function RegionList({
  generations,
  linked,
}: {
  generations: GenerationProgress[]
  linked: boolean
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
              <Link
                to={pokedexUrl({ generation: generation.id })}
                className={cx(styles.region, styles.link)}
              >
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
