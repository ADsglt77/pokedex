import { RadialProgress } from '@camply/ui'
import { Panel } from '@/components/Panel'
import { ProgressRuler } from '@/components/ProgressRuler'
import { RegionList } from '@/components/RegionList'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePokedex } from '@/hooks/usePokedex'
import { cx } from '@/lib/cx'
import { formatInteger, plural, unlockedOf } from '@/lib/format'
import { summarize, type Progress } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
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

/** La progression : l'anneau, la phrase, et la réglette des générations (une liste sur téléphone). */
export function ProgressPanel() {
  const { progress, generations } = usePokedex()
  const collection = useCollectionStore((state) => state.collection)
  const { ordered } = summarize(collection)
  const [unlockedText, remainingText] = progressSentence(progress)
  // Sur téléphone, la réglette n'est qu'une image : la liste des régions mène au Pokédex.
  const narrow = useMediaQuery('(max-width: 40rem)')

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
      <div inert={narrow} className={styles.ruler}>
        <ProgressRuler generations={generations} />
      </div>
      {narrow && <RegionList generations={generations} linked />}
    </Panel>
  )
}
