import { SegmentedControl } from '@camply/ui'
import { PriceChart } from '@/components/PriceChart'
import {
  CHART_PERIOD_LABELS,
  inWindow,
  levelStats,
  periodWindow,
  type ChartPeriod,
  type ChartStat,
  type PricePoint,
} from '@/lib/chart'
import { toOptions, today } from '@/lib/format'
import styles from './ChartParts.module.css'

const PERIOD_OPTIONS = toOptions(CHART_PERIOD_LABELS)

/** La période des courbes : 7 jours, 30 jours, 1 an, tout. */
export function ChartPeriodControl({
  value,
  onChange,
}: {
  value: ChartPeriod
  onChange: (period: ChartPeriod) => void
}) {
  return (
    <SegmentedControl
      aria-label="Période des courbes"
      size="sm"
      options={PERIOD_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}

/** Les chiffres d'une courbe sur sa période, sous elle. */
export function ChartStats({ items }: { items: ChartStat[] }) {
  if (items.length === 0) return null
  return (
    <dl className={styles.stats}>
      {items.map(({ label, value }) => (
        <div key={label} className={styles.stat}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Un prix ou une valeur (`series`, du premier jour connu au dernier), jour par jour sur la période,
 * et ses chiffres : le prix d'une carte, la valeur de la collection.
 */
export function LevelChart({
  series,
  period,
  label,
}: {
  series: PricePoint[]
  period: ChartPeriod
  label: string
}) {
  const window = periodWindow(period, today(), series[0]?.date ?? null)
  const points = inWindow(series, window)
  return (
    <>
      <PriceChart points={points} window={window} label={label} />
      <ChartStats items={levelStats(points)} />
    </>
  )
}
