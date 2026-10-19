import { useState } from 'react'
import { cx } from '@/lib/cx'
import type { CardStatus } from '@/types'
import styles from './PossessionMark.module.css'

/**
 * Marque de possession dans le coin d'une carte : possédée ou commandée ; rien sans statut (la
 * pochette d'un Pokémon à débloquer se reconnaît déjà, grisée). L'icône est dessinée en CSS (un
 * masque), pas en SVG : le Pokédex en affiche jusqu'à 1 025. Elle s'anime quand le statut change
 * sous les yeux, pas à l'affichage : les pages se remontent à chaque visite, le Pokédex rejouerait
 * toutes ses marques. Une fois, l'animation finie : une marque cachée puis remontrée (le Pokédex
 * gardé en vie, un filtre) la rejouerait sinon (le navigateur relance les animations d'un élément
 * qui réapparaît).
 */
export function PossessionMark({ status }: { status: CardStatus | null }) {
  // Le statut affiché, et s'il a changé depuis le premier rendu.
  const [shown, setShown] = useState({ status, changed: false })
  if (shown.status !== status) setShown({ status, changed: true })
  if (status === null) return null
  return (
    // La clé rejoue l'animation à chaque changement.
    <span
      key={status}
      className={cx(styles.mark, styles[status], shown.changed && styles.stamp)}
      onAnimationEnd={() => setShown({ status, changed: false })}
      aria-hidden="true"
    />
  )
}
