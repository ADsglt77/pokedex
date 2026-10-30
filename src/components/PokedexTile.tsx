import { memo } from 'react'
import { cx } from '@/lib/cx'
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
  none: 'À débloquer',
}

/**
 * Une pochette du classeur : la favorite de l'espèce (ou son dessin), son numéro et son nom ; un
 * lien vers sa fiche, sauf sur le Pokédex public (`linked` faux : la fiche serait celle du
 * visiteur), où c'est une image décrite. En couleur, marquée « possédée », dès qu'une des cartes de
 * l'espèce l'est, sa favorite ou non (`entry.status`). Un simple `<a>`, pas un `Link` de
 * react-router : celui-ci lit l'adresse, et les 1 025 pochettes se redessineraient à chaque frappe
 * de la recherche ; la page du classeur fait suivre ses liens par le routeur (`PokedexPage`).
 * Mémoïsée : quand la recherche ou un filtre change la grille, les pochettes restées ne se
 * redessinent pas (leur entrée est la même tant que la collection ne change pas).
 */
export const PokedexTile = memo(function PokedexTile({
  entry,
  eager,
  linked = true,
}: {
  entry: PokedexEntry
  eager?: boolean
  linked?: boolean
}) {
  const { species, card, status } = entry
  const label = `${formatDexNumber(species.id)} ${species.names.fr}, ${SPECIES_LABELS[status ?? 'none']}`
  const content = (
    <>
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
    </>
  )

  return linked ? (
    <a href={speciesPath(species.id)} className={cx(styles.tile, styles.pocket)} aria-label={label}>
      {content}
    </a>
  ) : (
    <div className={cx(styles.tile, styles.pocket)} role="img" aria-label={label}>
      {content}
    </div>
  )
})
