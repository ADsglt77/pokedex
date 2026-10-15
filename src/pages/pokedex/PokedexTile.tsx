import { memo } from 'react'
import { Link } from 'react-router'
import { speciesPath } from '@/lib/filters'
import { formatDexNumber } from '@/lib/format'
import type { PokedexEntry } from '@/lib/pokedex'
import type { CardStatus } from '@/types'
import { CardArt } from '@/components/CardArt'
import { PossessionMark } from '@/components/PossessionMark'
import styles from './PokedexTile.module.css'

const SPECIES_LABELS: Record<CardStatus | 'none', string> = {
  owned: 'Débloqué',
  ordered: 'À débloquer, carte commandée',
  wanted: 'À débloquer, carte souhaitée',
  none: 'À débloquer',
}

/**
 * Une pochette du classeur : la carte de l'espèce (ou son dessin), son numéro et son nom.
 * Mémoïsée : quand la recherche ou un filtre change la grille, les pochettes restées ne se
 * redessinent pas (leur entrée est la même tant que la collection ne change pas).
 */
export const PokedexTile = memo(function PokedexTile({
  entry,
  eager,
}: {
  entry: PokedexEntry
  eager?: boolean
}) {
  const { species, card } = entry
  const status = card?.status ?? null
  const label = `${formatDexNumber(species.id)} ${species.names.fr}, ${SPECIES_LABELS[status ?? 'none']}`

  return (
    <Link to={speciesPath(species.id)} className={styles.tile} aria-label={label}>
      <CardArt
        card={card?.card ?? null}
        speciesId={species.id}
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
})
