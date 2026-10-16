import { Button, EmptyState, Progress } from '@camply/ui'
import { Inbox } from '@camply/ui/icons'
import { Link } from 'react-router'
import { usePokedex } from '@/hooks/usePokedex'
import { isEmptySummary, summarize } from '@/lib/pokedex'
import { formatDateTime, formatDecimal, unlockedOf } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { MissingImages } from './MissingImages'
import { SummaryLedger } from './SummaryLedger'
import styles from './DataPage.module.css'

/** Où en est la collection, ou comment la commencer quand elle est vide ; où elle est gardée. */
export function CollectionSection() {
  const collection = useCollectionStore((state) => state.collection)
  const { progress } = usePokedex()
  const summary = summarize(collection)
  const updatedAt = formatDateTime(collection.updatedAt)

  return (
    <DataSection
      id="collection"
      title="Ma collection"
      description="Synchronisée avec votre compte : la même sur tous vos appareils, et sauvegardée sur le serveur."
    >
      {isEmptySummary(summary) ? (
        <EmptyState
          align="start"
          icon={<Inbox size={22} />}
          title="Votre collection est vide"
          description="Ouvrez le Pokédex, choisissez un Pokémon, ajoutez la carte que vous voulez, puis marquez-la comme commandée ou possédée. Une collection exportée depuis un autre navigateur s’importe plus bas sur cette page."
          actions={
            <>
              <Button asChild>
                <Link to="/pokedex">Ouvrir le Pokédex</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="#importer">Importer une collection</a>
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div className={styles.progress}>
            <p>
              <strong className="numeric">{unlockedOf(progress, 'Pokémon')}</strong>, soit{' '}
              {formatDecimal(progress.percent)}
              {' '}% du Pokédex.
            </p>
            <Progress
              size="sm"
              value={progress.unlocked}
              max={progress.total}
              aria-label="Pokémon débloqués"
            />
          </div>
          <SummaryLedger summary={summary} />
          <MissingImages />
        </>
      )}
      {updatedAt && <p className="hint">Dernière modification le {updatedAt}.</p>}
    </DataSection>
  )
}
