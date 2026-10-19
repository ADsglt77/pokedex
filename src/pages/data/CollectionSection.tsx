import { Button, EmptyState, Progress } from '@camply/ui'
import { Inbox } from '@camply/ui/icons'
import { useRef } from 'react'
import { Link } from 'react-router'
import { usePokedex } from '@/hooks/usePokedex'
import { summarize } from '@/lib/pokedex'
import { formatDateTime, formatShare, unlockedOf } from '@/lib/format'
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
  const title = useRef<HTMLHeadingElement>(null)

  return (
    <DataSection
      id="collection"
      title="Ma collection"
      titleRef={title}
      description="Synchronisée avec votre compte : la même sur tous vos appareils, et sauvegardée sur le serveur."
    >
      {summary.cards === 0 ? (
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
              {formatShare(progress.percent)} du Pokédex.
            </p>
            <Progress
              size="sm"
              value={progress.unlocked}
              max={progress.total}
              aria-label="Pokémon débloqués"
            />
          </div>
          <SummaryLedger summary={summary} />
          <MissingImages title={title} />
        </>
      )}
      {updatedAt && <p className="hint">Dernière modification le {updatedAt}.</p>}
    </DataSection>
  )
}
