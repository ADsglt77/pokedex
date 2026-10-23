import { Progress } from '@camply/ui'
import type { ReactNode } from 'react'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { cardLanguage } from '@/lib/collection'
import { formatInteger } from '@/lib/format'
import { progressPercent } from '@/lib/pokedex'
import type { SeriesCollection } from '@/types'
import styles from './SeriesLine.module.css'

/**
 * Où en est une collection d'extension, en une ligne : son nom et le drapeau de sa langue, ses
 * cartes possédées sur toutes (« 87 / 230 »), la barre. `heading` : le nom est un titre (le Pokédex
 * public) ; sinon un simple texte, la ligne entière étant un lien (l'accueil). `children` : un
 * chiffre de plus, après celui des cartes.
 */
export function SeriesLine({
  series,
  owned,
  total,
  heading = false,
  children,
}: {
  series: SeriesCollection
  owned: number
  total: number
  heading?: boolean
  children?: ReactNode
}) {
  const Name = heading ? 'h3' : 'span'
  return (
    <div className={styles.line}>
      <Name className={styles.name}>
        {series.name}
        <LanguageFlag language={cardLanguage(series)} of="set" />
      </Name>
      <span className={styles.figures}>
        <span className="numeric">
          {formatInteger(owned)} / {formatInteger(total)}
          <span className="visually-hidden"> cartes possédées</span>
        </span>
        {children}
      </span>
      <Progress
        size="sm"
        value={progressPercent(owned, total)}
        aria-hidden
        className={styles.bar}
      />
    </div>
  )
}
