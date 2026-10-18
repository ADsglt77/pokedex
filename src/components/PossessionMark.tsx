import { useState } from 'react'
import { cx } from '@/lib/cx'
import type { CardStatus } from '@/types'
import styles from './PossessionMark.module.css'

/**
 * Marque de possession dans le coin d'une carte : une icône par statut, cadenas sinon. L'icône est
 * dessinée en CSS (un masque), pas en SVG : le Pokédex en affiche plus de 1 000. Elle s'anime
 * quand le statut change sous les yeux, pas à l'affichage : les pages se remontent à chaque visite,
 * le Pokédex rejouerait des dizaines de cadenas.
 */
export function PossessionMark({ status }: { status: CardStatus | null }) {
  // Le statut affiché, et s'il a changé depuis le premier rendu.
  const [shown, setShown] = useState({ status, changed: false })
  if (shown.status !== status) setShown({ status, changed: true })
  return (
    // La clé rejoue l'animation à chaque changement.
    <span
      key={status ?? 'none'}
      className={cx(styles.mark, styles[status ?? 'none'], shown.changed && styles.stamp)}
      aria-hidden="true"
    />
  )
}
