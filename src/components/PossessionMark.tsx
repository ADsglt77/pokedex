import { Lock } from '@camply/ui/icons'
import { cx } from '@/lib/cx'
import type { CardStatus } from '@/types'
import { STATUS_ICONS } from './statusIcons'
import styles from './PossessionMark.module.css'

const ICONS = { ...STATUS_ICONS, none: Lock }

/** Marque de possession dans le coin d'une carte : une icône par statut, cadenas sinon. */
export function PossessionMark({ status }: { status: CardStatus | null }) {
  const Icon = ICONS[status ?? 'none']
  return (
    // La clé rejoue l'animation quand le statut change.
    <span
      key={status ?? 'none'}
      className={cx(styles.mark, styles[status ?? 'none'])}
      aria-hidden="true"
    >
      <Icon size={14} strokeWidth={status === 'owned' ? 3 : 2} />
    </span>
  )
}
