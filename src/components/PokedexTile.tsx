import { Link } from 'react-router'
import { formatDexNumber } from '@/lib/format'
import { speciesStatus, type PokedexEntry } from '@/lib/pokedex'
import type { CardStatus } from '@/types'
import { CardArt } from './CardArt'
import { PossessionMark } from './PossessionMark'
import styles from './PokedexTile.module.css'

const SPECIES_LABELS: Record<CardStatus | 'none', string> = {
  owned: 'Possédé',
  ordered: 'Non possédé, carte commandée',
  wanted: 'Non possédé, carte souhaitée',
  none: 'Non possédé',
}

/** Une pochette du classeur : la carte qui représente l'espèce, son numéro et son nom. */
export function PokedexTile({ entry, eager }: { entry: PokedexEntry; eager?: boolean }) {
  const { species, representative } = entry
  const status = speciesStatus(entry)
  const label = `${formatDexNumber(species.id)} ${species.names.fr}, ${SPECIES_LABELS[status ?? 'none']}`

  return (
    <Link to={`/pokemon/${species.id}`} className={styles.tile} aria-label={label}>
      <CardArt
        image={entry.image}
        hasCard={representative !== null}
        speciesId={species.id}
        reference={representative?.card.reference}
        alt=""
        locked={!entry.unlocked}
        eager={eager}
        className={styles.art}
      >
        <PossessionMark status={status} />
      </CardArt>
      <span className={styles.number}>{formatDexNumber(species.id)}</span>
      <span className={styles.name}>{species.names.fr}</span>
    </Link>
  )
}
