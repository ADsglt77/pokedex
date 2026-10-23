import type { ReactNode } from 'react'
import { CardArt } from '@/components/CardArt'
import { CardPageLink } from '@/components/CardPageLink'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { cardLanguage } from '@/lib/collection'
import { cx } from '@/lib/cx'
import { cardTitle } from '@/lib/species'
import type { PokemonCard, SeriesCollection } from '@/types'
import styles from './CardLine.module.css'

/**
 * Une carte sur une ligne : vignette, nom (le lien vers sa page, s'il y en a une : `CardPageLink`),
 * référence et langue, la collection d'extension dont elle est une case (`series`), un détail, et
 * des actions à droite. Une carte retirée du Pokédex depuis (`null`, toujours dans une commande) le
 * dit à leur place.
 */
export function CardLine({
  card,
  series,
  detail,
  children,
}: {
  card: PokemonCard | null
  series: SeriesCollection | null
  detail?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className={styles.line}>
      {card ? (
        <>
          <CardArt card={card} speciesId={card.dexIds[0]} alt="" className={styles.lineArt} />
          <div className={styles.lineText}>
            <CardPageLink
              card={card}
              series={series}
              className={cx('quiet-link', styles.lineTitle)}
            >
              {cardTitle(card)}
            </CardPageLink>
            <span className="muted">
              {card.reference}
              <LanguageFlag language={cardLanguage(card)} />
              {series && <> · collection {series.name}</>}
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
