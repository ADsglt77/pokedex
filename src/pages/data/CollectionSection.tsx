import { Button, EmptyState } from '@camply/ui'
import { Inbox } from '@camply/ui/icons'
import { Link } from 'react-router'
import { usePokedex } from '@/hooks/usePokedex'
import { isEmptySummary, summarize } from '@/lib/collection'
import { formatDateTime, formatDecimal, unlockedOf } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'

/** Où en est la collection, ou comment la commencer quand elle est vide. */
export function CollectionSection() {
  const collection = useCollectionStore((state) => state.collection)
  const { progress } = usePokedex()
  const summary = summarize(collection)
  const updatedAt = formatDateTime(collection.updatedAt)

  return (
    <DataSection id="collection" title="Ma collection">
      {isEmptySummary(summary) ? (
        <EmptyState
          align="start"
          icon={<Inbox size={22} />}
          title="Votre collection est vide"
          description="Ouvrez le Pokédex, choisissez un Pokémon et marquez une de ses cartes comme possédée, souhaitée ou commandée. Une collection exportée depuis un autre navigateur s’importe plus bas sur cette page."
          actions={
            <>
              <Button asChild>
                <Link to="/pokedex">Ouvrir le Pokédex</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="#importer">Importer une collection</Link>
              </Button>
            </>
          }
        />
      ) : (
        <>
          <p>
            {unlockedOf(progress, 'Pokémon')}, soit {formatDecimal(progress.percent)} % du Pokédex.
          </p>
          <SummaryLedger summary={summary} />
        </>
      )}
      <p>
        {updatedAt ? `Dernière modification le ${updatedAt}. ` : ''}
        Votre collection n’existe que dans ce navigateur, sur cet appareil : un export est sa seule
        sauvegarde.
      </p>
    </DataSection>
  )
}
