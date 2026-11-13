import { Stat } from '@camply/ui'
import { PricedValue } from '@/components/PricedValue'
import { STATUS_ICONS } from '@/components/statusIcons'
import { formatEuro } from '@/lib/format'
import { gainPercent, tallyByStatus, tallyHint, trackedCards } from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'
import { SUMMARY_STAT, useStatSize } from '@/hooks/useStatSize'

/**
 * La valeur des cartes possédées au prix du jour, et l'écart avec ce qu'elles ont coûté : la même
 * statistique, en tuile sur l'accueil, dans la ligne de résumé de la page Valeur (`summary`).
 */
export function CollectionValueStat({
  label,
  summary = false,
}: {
  label: string
  summary?: boolean
}) {
  const statSize = useStatSize()
  const prices = usePrices()
  const collection = useCollectionStore((state) => state.collection)
  const owned = tallyByStatus(trackedCards(collection, prices)).owned
  return (
    <Stat
      {...(summary ? SUMMARY_STAT : { size: statSize })}
      label={label}
      icon={<STATUS_ICONS.owned size={18} />}
      value={<PricedValue>{formatEuro(owned.value)}</PricedValue>}
      delta={prices ? gainPercent(owned.paidCardsValue, owned.paid) : undefined}
      deltaSuffix={'\u00a0%'}
      hint={tallyHint(owned, prices !== null)}
    />
  )
}
