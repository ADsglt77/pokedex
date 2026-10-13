import { cx } from '@/lib/cx'
import type { CardStatus } from '@/types'
import styles from './PossessionMark.module.css'

/**
 * Marque de possession dans le coin d'une carte : une icône par statut, cadenas sinon. L'icône est
 * dessinée en CSS (un masque), pas en SVG : le Pokédex en affiche plus de 1 000.
 */
export function PossessionMark({ status }: { status: CardStatus | null }) {
  return (
    // La clé rejoue l'animation quand le statut change.
    <span
      key={status ?? 'none'}
      className={cx(styles.mark, styles[status ?? 'none'])}
      aria-hidden="true"
    />
  )
}
