import { memo } from 'react'
import { Link } from 'react-router'
import { formatDexNumber } from '@/lib/format'
import type { PokedexEntry } from '@/lib/pokedex'
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
    <Link to={`/pokemon/${species.id}`} className={styles.tile} aria-label={label}>
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
