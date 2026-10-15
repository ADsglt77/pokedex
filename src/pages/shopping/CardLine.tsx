import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { speciesPath } from '@/lib/filters'
import { CardArt } from '@/components/CardArt'
import { cardTitle } from '@/lib/species'
import type { PokemonCard } from '@/types'
import styles from './ShoppingPage.module.css'

/**
 * Une carte sur une ligne : vignette, nom et référence, un détail, et des actions à droite. Une
 * carte retirée du Pokédex depuis (`null`, toujours dans une commande) le dit à leur place.
 */
export function CardLine({
  card,
  detail,
  children,
}: {
  card: PokemonCard | null
  detail?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className={styles.line}>
      {card ? (
        <>
          <CardArt card={card} speciesId={card.dexIds[0]!} alt="" className={styles.lineArt} />
          <div className={styles.lineText}>
            <Link to={speciesPath(card.dexIds[0]!)} className={styles.lineTitle}>
              {cardTitle(card)}
            </Link>
            <span className="muted">
              {card.reference}
              {detail && <> · {detail}</>}
            </span>
          </div>
        </>
      ) : (
        <span className="muted">
          Carte retirée du Pokédex
          {detail && <> · {detail}</>}
        </span>
      )}
      {children && <div className={styles.lineEnd}>{children}</div>}
    </div>
  )
}
