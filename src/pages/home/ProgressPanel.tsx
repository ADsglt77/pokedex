import { RadialProgress } from '@camply/ui'
import { Link } from 'react-router'
import { Panel } from '@/components/Panel'
import { ProgressRuler } from '@/components/ProgressRuler'
import { SeriesLine } from '@/components/SeriesLine'
import { usePokedex } from '@/hooks/usePokedex'
import { cardLanguage } from '@/lib/collection'
import { cx } from '@/lib/cx'
import { seriesPath } from '@/lib/filters'
import { formatInteger, plural, unlockedOf } from '@/lib/format'
import { summarize, type Progress } from '@/lib/pokedex'
import { seriesProgress } from '@/lib/series'
import { useCollectionStore } from '@/store/collection'
import type { CollectionData, SeriesCollection } from '@/types'
import styles from './ProgressPanel.module.css'

function progressSentence(progress: Progress) {
  const { unlocked, missing, total } = progress
  if (unlocked === 0) {
    return [
      'Aucun Pokémon débloqué pour l’instant.',
      `Les ${formatInteger(total)} restent à débloquer.`,
    ]
  }
  if (missing === 0)
    return [`Les ${formatInteger(total)} Pokémon sont débloqués.`, 'Le Pokédex est complet.']
  return [
    `${unlockedOf(progress, 'Pokémon')}.`,
    missing === 1
      ? 'Il n’en reste qu’un à débloquer.'
      : `Il en reste ${formatInteger(missing)} à débloquer.`,
  ]
}

/**
 * La progression : l'anneau, la phrase et la réglette compacte des générations ; dessous, celle de
 * chaque collection d'extension (rien sans collection).
 */
export function ProgressPanel() {
  const { progress, generations } = usePokedex()
  const collection = useCollectionStore((state) => state.collection)
  const { ordered } = summarize(collection)
  const [unlockedText, remainingText] = progressSentence(progress)
  return (
    <Panel title="Progression">
      <div className={styles.progress}>
        <RadialProgress
          value={progress.percent}
          size={128}
          thickness={10}
          label="Pokémon débloqués"
          aria-valuetext={unlockedOf(progress)}
        >
          <span className={styles.ring}>
            <span className={cx(styles.ringValue, 'numeric')}>
              {formatInteger(progress.unlocked)}
            </span>
            <span className="hint">sur {formatInteger(progress.total)}</span>
          </span>
        </RadialProgress>
        <div className={styles.sentence}>
          <p className={styles.lead}>{unlockedText}</p>
          <p className="muted">{remainingText}</p>
          {ordered > 0 && (
            <p className="muted">{plural(ordered, 'carte commandée', 'cartes commandées')}.</p>
          )}
        </div>
      </div>
      <div className={styles.ruler}>
        <ProgressRuler generations={generations} />
      </div>
      {collection.series.length > 0 && (
        <div className={styles.collections}>
          <h3 className={styles.collectionsTitle}>Collections</h3>
          <ul>
            {collection.series.map((series) => (
              <li key={`${cardLanguage(series)} ${series.set}`}>
                <SeriesLink collection={collection} series={series} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/** Une collection : sa ligne (`SeriesLine`), lien vers sa page. Les prix ne comptent pas ici. */
function SeriesLink({
  collection,
  series,
}: {
  collection: CollectionData
  series: SeriesCollection
}) {
  const { owned, total } = seriesProgress(collection, series, null)
  return (
    <Link to={seriesPath(series.set, cardLanguage(series))} className={styles.collection}>
      <SeriesLine series={series} owned={owned} total={total} />
    </Link>
  )
}
