import { ChartStats } from '@/components/ChartParts'
import { PriceChart } from '@/components/PriceChart'
import {
  firstDate,
  inWindow,
  periodWindow,
  runningTotal,
  weeksOf,
  type ChartPeriod,
} from '@/lib/chart'
import { formatDecimal, formatInteger } from '@/lib/format'
import type { PricePoint } from '@/lib/prices'

/**
 * Les Pokémon débloqués : le total, jour après jour sur la période (`events` : `unlockEvents`), et
 * ses chiffres (gagnés sur la période, au total, par semaine). Valeur et Pokédex public. `day` :
 * aujourd'hui, le dernier jour de la période.
 */
export function UnlockedChart({
  events,
  period,
  day,
}: {
  events: PricePoint[]
  period: ChartPeriod
  day: string
}) {
  if (events.length === 0) return <p className="muted">Aucun Pokémon débloqué pour l’instant.</p>
  const window = periodWindow(period, day, firstDate(events))
  const points = runningTotal(events, window, true)
  const gained = inWindow(events, window).length
  return (
    <>
      <PriceChart
        points={points}
        window={window}
        label="Pokémon débloqués"
        format={formatInteger}
        fromZero
      />
      <ChartStats
        items={[
          { label: 'Sur la période', value: `+${formatInteger(gained)}` },
          { label: 'Au total', value: formatInteger(points.at(-1)!.value) },
          { label: 'Par semaine', value: formatDecimal(gained / weeksOf(window)) },
        ]}
      />
    </>
  )
}
